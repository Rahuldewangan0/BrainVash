import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

// RFC 4180 compliant CSV parser that handles quoted strings, escaped quotes, commas, and multi-line fields
function parseCSV(text) {
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++ // Skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        // Skip carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

// Validates and maps raw CSV rows into structured Question Bank objects
function validateAndParseCsvQuestions(rawText, fallbackSubjectId, subjectsList, existingQuestionsList) {
  if (!rawText || !rawText.trim()) {
    return { rows: [], errors: [], validCount: 0, errorCount: 0, duplicateCount: 0 }
  }

  const rawRows = parseCSV(rawText)
  if (rawRows.length === 0) {
    return { rows: [], errors: [{ row: 0, error: 'CSV file is empty.' }], validCount: 0, errorCount: 1, duplicateCount: 0 }
  }

  // Detect and index header columns
  const firstRow = rawRows[0].map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''))
  let headerMap = null
  let startIndex = 0

  const hasHeader = firstRow.some((col) =>
    ['questiontext', 'question', 'statement', 'optiona', 'correctoptionindex', 'correctoption', 'answer'].includes(col)
  )

  if (hasHeader) {
    headerMap = {}
    firstRow.forEach((col, idx) => {
      if (['questiontext', 'question', 'statement'].includes(col)) headerMap.question_text = idx
      else if (['optiona', 'a'].includes(col)) headerMap.option_a = idx
      else if (['optionb', 'b'].includes(col)) headerMap.option_b = idx
      else if (['optionc', 'c'].includes(col)) headerMap.option_c = idx
      else if (['optiond', 'd'].includes(col)) headerMap.option_d = idx
      else if (['correctoptionindex', 'correctoption', 'correctindex', 'correctanswer', 'answer', 'correct'].includes(col)) headerMap.correct_option_index = idx
      else if (['explanation', 'explain', 'solution'].includes(col)) headerMap.explanation = idx
      else if (['marks', 'mark', 'points'].includes(col)) headerMap.marks = idx
      else if (['difficulty', 'diff', 'level'].includes(col)) headerMap.difficulty = idx
      else if (['topic', 'tag', 'topicname'].includes(col)) headerMap.topic = idx
      else if (['subjectname', 'subject', 'subjectcode'].includes(col)) headerMap.subject_name = idx
      else if (['codesnippet', 'code', 'snippet'].includes(col)) headerMap.code_snippet = idx
    })
    startIndex = 1
  }

  // Duplicate detection sets
  const existingSet = new Set(
    (existingQuestionsList || []).map((q) => (q.question_text || '').toLowerCase().trim())
  )
  const seenInCsv = new Set()

  const parsedItems = []
  const allErrors = []
  let validCount = 0
  let errorCount = 0
  let duplicateCount = 0

  for (let r = startIndex; r < rawRows.length; r++) {
    const row = rawRows[r]
    const rowNum = r + 1

    const getVal = (key, fallbackIdx) => {
      if (headerMap && headerMap[key] !== undefined) {
        return row[headerMap[key]] !== undefined ? row[headerMap[key]] : ''
      }
      return row[fallbackIdx] !== undefined ? row[fallbackIdx] : ''
    }

    const questionText = getVal('question_text', 0)
    const optA = getVal('option_a', 1)
    const optB = getVal('option_b', 2)
    const optC = getVal('option_c', 3)
    const optD = getVal('option_d', 4)
    const rawCorrect = getVal('correct_option_index', 5)
    const rawExplanation = getVal('explanation', 6)
    const rawMarks = getVal('marks', 7)
    const rawDiff = getVal('difficulty', 8)
    const rawTopic = getVal('topic', 9)
    const rawSubject = getVal('subject_name', 10)
    const rawCodeSnippet = getVal('code_snippet', 11)

    const rowErrors = []

    // 1. Validate question_text
    if (!questionText || questionText.trim().length < 3) {
      rowErrors.push('Missing or too short question_text (minimum 3 characters required).')
    }

    // 2. Validate options
    if (!optA || !optB || !optC || !optD) {
      rowErrors.push('All 4 options (option_a, option_b, option_c, option_d) must be non-empty.')
    }

    // 3. Validate correct_option_index (0-3 or A-D)
    let correctIndex = -1
    const cleanCorrect = (rawCorrect !== undefined && rawCorrect !== null ? rawCorrect : '').toString().trim().toUpperCase()
    if (cleanCorrect === '0' || cleanCorrect === 'A') correctIndex = 0
    else if (cleanCorrect === '1' || cleanCorrect === 'B') correctIndex = 1
    else if (cleanCorrect === '2' || cleanCorrect === 'C') correctIndex = 2
    else if (cleanCorrect === '3' || cleanCorrect === 'D') correctIndex = 3
    else {
      rowErrors.push(`Invalid correct_option_index "${rawCorrect}". Must be 0, 1, 2, or 3 (or A, B, C, D).`)
    }

    // 4. Validate difficulty (easy, medium, hard)
    let diff = (rawDiff || '').toString().trim().toLowerCase()
    if (!diff) {
      diff = 'medium'
    } else if (!['easy', 'medium', 'hard'].includes(diff)) {
      rowErrors.push(`Invalid difficulty "${rawDiff}". Must be easy, medium, or hard.`)
    }

    // 5. Validate marks (positive integer)
    let marks = 1
    if (rawMarks !== undefined && rawMarks !== '') {
      const parsedMarks = parseInt(rawMarks, 10)
      if (isNaN(parsedMarks) || parsedMarks <= 0) {
        rowErrors.push(`Invalid marks "${rawMarks}". Must be a positive integer.`)
      } else {
        marks = parsedMarks
      }
    }

    // 6. Resolve subject
    let resolvedSubjectId = fallbackSubjectId || null
    let resolvedSubjectName = ''
    if (rawSubject && rawSubject.trim()) {
      const subTrim = rawSubject.trim().toLowerCase()
      const matched = (subjectsList || []).find(
        (s) => s.name?.toLowerCase() === subTrim || s.code?.toLowerCase() === subTrim
      )
      if (matched) {
        resolvedSubjectId = matched.id
        resolvedSubjectName = matched.name
      }
    }

    if (!resolvedSubjectName && resolvedSubjectId) {
      const fallbackSub = (subjectsList || []).find((s) => s.id === resolvedSubjectId)
      if (fallbackSub) resolvedSubjectName = fallbackSub.name
    }

    if (!resolvedSubjectId) {
      rowErrors.push(`Could not resolve subject "${rawSubject || 'empty'}". Please select a fallback subject in the dropdown.`)
    }

    // 7. Duplicate detection
    const norm = (questionText || '').toLowerCase().trim()
    let isDuplicate = false
    let duplicateReason = ''
    if (norm) {
      if (seenInCsv.has(norm)) {
        isDuplicate = true
        duplicateReason = 'Duplicate question within this CSV file'
        duplicateCount++
      } else if (existingSet.has(norm)) {
        isDuplicate = true
        duplicateReason = 'Question already exists in Question Bank'
        duplicateCount++
      }
      seenInCsv.add(norm)
    }

    const hasError = rowErrors.length > 0
    if (hasError) {
      errorCount++
      allErrors.push({ row: rowNum, text: questionText || `Row ${rowNum}`, errors: rowErrors })
    } else {
      validCount++
    }

    parsedItems.push({
      rowNumber: rowNum,
      question_text: (questionText || '').trim(),
      options: [optA || '', optB || '', optC || '', optD || ''],
      correct_option_index: correctIndex,
      explanation: (rawExplanation || '').trim(),
      marks,
      difficulty: diff,
      topic: (rawTopic || '').trim(),
      subject_name: resolvedSubjectName || rawSubject || '',
      resolvedSubjectId,
      code_snippet: (rawCodeSnippet || '').trim() || null,
      hasError,
      errors: rowErrors,
      isDuplicate,
      duplicateReason,
    })
  }

  return {
    rows: parsedItems,
    errors: allErrors,
    validCount,
    errorCount,
    duplicateCount,
  }
}

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')

  // Question Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [saving, setSaving] = useState(false)

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk CSV Import States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [csvDefaultSubject, setCsvDefaultSubject] = useState('')
  const [csvSelectedQuiz, setCsvSelectedQuiz] = useState('')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [csvValidationResult, setCsvValidationResult] = useState(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportProgress, setCsvImportProgress] = useState({ current: 0, total: 0, currentText: '' })
  const [csvImportResults, setCsvImportResults] = useState(null)
  const [csvViewTab, setCsvViewTab] = useState('preview') // 'preview' | 'errors'

  // Form data
  const [form, setForm] = useState({
    question_text: '',
    code_snippet: '',
    options: ['', '', '', ''],
    correct_option_index: 0,
    explanation: '',
    marks: 1,
    difficulty: 'medium',
    subject_id: '',
    quiz_id: '',
    topic: '',
  })

  useEffect(() => {
    let ignore = false

    async function loadData() {
      if (!supabase) return
      setLoading(true)
      setError('')

      try {
        // Subjects
        const { data: subData } = await supabase
          .from('subjects')
          .select('id, name, code')
          .order('name')
        if (!ignore) {
          setSubjects(subData || [])
          setCsvDefaultSubject((prev) => prev || (subData && subData.length > 0 ? subData[0].id : ''))
        }

        // Quizzes (for assignment)
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('id, title')
          .order('title')
        if (!ignore) setQuizzes(quizData || [])

        // Questions — fetch scalar columns only.
        // Avoid embedding quizzes here because questions may have multiple
        // foreign-key paths to quizzes (direct quiz_id and quiz_questions).
        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select(`
            id,
            quiz_id,
            subject_id,
            question_text,
            question_type,
            code_snippet,
            options,
            marks,
            difficulty,
            topic,
            order_index,
            created_at
          `)
          .order('created_at', { ascending: false })

        if (qErr) throw new Error(qErr.message)

        // Resolve labels locally using the subjects and quizzes already fetched.
        const subjectById = new Map((subData || []).map((subject) => [subject.id, subject]))
        const quizById = new Map((quizData || []).map((quiz) => [quiz.id, quiz]))

        const loadedQuestions = (qData || []).map((question) => ({
          ...question,
          difficulty: question.difficulty || 'medium',
          topic: question.topic || '',
          subjects: subjectById.get(question.subject_id) || null,
          quizzes: quizById.get(question.quiz_id) || null,
        }))

        if (!ignore) setQuestions(loadedQuestions)
      } catch (err) {
        if (!ignore) setError(err.message || 'Error loading question bank.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadData()
    return () => {
      ignore = true
    }
  }, [refreshTrigger])

  // Filtered questions
  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterDifficulty !== 'all' && (q.difficulty || 'medium') !== filterDifficulty) return false
      if (filterSubject !== 'all' && q.subject_id !== filterSubject) return false
      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase().trim()
        const textMatch = q.question_text?.toLowerCase().includes(s)
        const topicMatch = q.topic?.toLowerCase().includes(s)
        const subMatch = q.subjects?.name?.toLowerCase().includes(s)
        if (!textMatch && !topicMatch && !subMatch) return false
      }
      return true
    })
  }, [questions, filterDifficulty, filterSubject, searchQuery])

  // Difficulty counts
  const diffCounts = useMemo(() => {
    const easy = questions.filter((q) => q.difficulty === 'easy').length
    const medium = questions.filter((q) => !q.difficulty || q.difficulty === 'medium').length
    const hard = questions.filter((q) => q.difficulty === 'hard').length
    return { easy, medium, hard, total: questions.length }
  }, [questions])

  // Open Create
  const handleOpenCreate = () => {
    setEditingQuestion(null)
    setForm({
      question_text: '',
      code_snippet: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
      marks: 1,
      difficulty: 'medium',
      subject_id: subjects.length > 0 ? subjects[0].id : '',
      quiz_id: '',
      topic: '',
    })
    setIsFormOpen(true)
    setError('')
  }

  // Open Edit — fetch answer key for existing question
  const handleOpenEdit = async (question) => {
    setEditingQuestion(question)
    setForm({
      question_text: question.question_text || '',
      code_snippet: question.code_snippet || '',
      options: Array.isArray(question.options) ? [...question.options] : ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
      marks: question.marks || 1,
      difficulty: question.difficulty || 'medium',
      subject_id: question.subject_id || '',
      quiz_id: question.quiz_id || '',
      topic: question.topic || '',
    })

    // Try fetching the answer key (admin only)
    try {
      const { data: akData } = await supabase
        .from('question_answer_keys')
        .select('correct_option_index, explanation')
        .eq('question_id', question.id)
        .single()

      if (akData) {
        setForm((prev) => ({
          ...prev,
          correct_option_index: akData.correct_option_index ?? 0,
          explanation: akData.explanation || '',
        }))
      }
    } catch (akErr) {
      console.warn('[QuestionBank] Answer key fetch notice:', akErr.message)
    }

    setIsFormOpen(true)
    setError('')
  }

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault()

    // Client-side validation
    if (!form.question_text.trim()) {
      setError('Question text cannot be empty.')
      return
    }
    const emptyOpt = form.options.findIndex((o) => !o.trim())
    if (emptyOpt !== -1) {
      setError(`Option ${String.fromCharCode(65 + emptyOpt)} cannot be empty.`)
      return
    }
    if (form.correct_option_index < 0 || form.correct_option_index > 3) {
      setError('Correct answer must be A, B, C or D.')
      return
    }
    if (!form.marks || form.marks <= 0) {
      setError('Marks must be a positive number.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      // Try using admin_save_question RPC first
      const { error: rpcErr } = await supabase.rpc('admin_save_question', {
        p_question_id: editingQuestion?.id || null,
        p_quiz_id: form.quiz_id || null,
        p_subject_id: form.subject_id || null,
        p_topic: form.topic || null,
        p_difficulty: form.difficulty || 'medium',
        p_question_text: form.question_text.trim(),
        p_code_snippet: form.code_snippet || null,
        p_options: form.options,
        p_marks: Number(form.marks),
        p_correct_option_index: Number(form.correct_option_index),
        p_explanation: form.explanation || null,
      })

      if (rpcErr) {
        // Fallback: direct table operations if RPC is not yet available (pre-migration)
        const questionPayload = {
          quiz_id: form.quiz_id || null,
          subject_id: form.subject_id || null,
          topic: form.topic || null,
          difficulty: form.difficulty || 'medium',
          question_text: form.question_text.trim(),
          code_snippet: form.code_snippet || null,
          options: form.options,
          marks: Number(form.marks),
        }

        if (editingQuestion) {
          let { error: updErr } = await supabase
            .from('questions')
            .update(questionPayload)
            .eq('id', editingQuestion.id)

          if (updErr && (updErr.message.includes('column') || updErr.message.includes('does not exist'))) {
            // Fallback for Phase 1 without subject_id / topic / difficulty
            const basePayload = {
              quiz_id: questionPayload.quiz_id,
              question_text: questionPayload.question_text,
              code_snippet: questionPayload.code_snippet,
              options: questionPayload.options,
              marks: questionPayload.marks,
            }
            const resBase = await supabase
              .from('questions')
              .update(basePayload)
              .eq('id', editingQuestion.id)

            updErr = resBase.error
          }

          if (updErr) {
            if (updErr.message.includes('permission denied')) {
              throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level UPDATE grants on questions. Deploying the Phase 2 migration will grant full admin permissions.`)
            }
            throw new Error(updErr.message)
          }

          // Upsert answer key
          await supabase
            .from('question_answer_keys')
            .upsert({
              question_id: editingQuestion.id,
              correct_option_index: Number(form.correct_option_index),
              explanation: form.explanation || null,
            }, { onConflict: 'question_id' })

          setSuccessMsg('Question updated successfully.')
        } else {
          let { data: insData, error: insErr } = await supabase
            .from('questions')
            .insert([questionPayload])
            .select('id')
            .single()

          if (insErr && (insErr.message.includes('column') || insErr.message.includes('does not exist'))) {
            // Fallback for Phase 1 without subject_id / topic / difficulty
            const basePayload = {
              quiz_id: questionPayload.quiz_id,
              question_text: questionPayload.question_text,
              code_snippet: questionPayload.code_snippet,
              options: questionPayload.options,
              marks: questionPayload.marks,
            }
            const resBase = await supabase
              .from('questions')
              .insert([basePayload])
              .select('id')
              .single()

            insData = resBase.data
            insErr = resBase.error
          }

          if (insErr) {
            if (insErr.message.includes('permission denied')) {
              throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level INSERT grants on questions. Deploying the Phase 2 migration will grant full admin permissions.`)
            }
            throw new Error(insErr.message)
          }

          // Insert answer key
          if (insData?.id) {
            await supabase
              .from('question_answer_keys')
              .insert({
                question_id: insData.id,
                correct_option_index: Number(form.correct_option_index),
                explanation: form.explanation || null,
              })
          }

          setSuccessMsg('Question created successfully.')
        }
      } else {
        setSuccessMsg(editingQuestion ? 'Question updated via secure RPC.' : 'Question created via secure RPC.')
      }

      setIsFormOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(err.message || 'Failed to save question.')
    } finally {
      setSaving(false)
    }
  }

  // Delete question
  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    setError('')
    setSuccessMsg('')

    try {
      // Delete answer key first (cascading on FK should handle this, but be explicit)
      await supabase
        .from('question_answer_keys')
        .delete()
        .eq('question_id', deleteConfirm.id)

      const { error: delErr } = await supabase
        .from('questions')
        .delete()
        .eq('id', deleteConfirm.id)

      if (delErr) throw new Error(delErr.message)

      setSuccessMsg('Question deleted successfully.')
      setDeleteConfirm(null)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // Open CSV Import Modal
  const handleOpenCsvModal = () => {
    setIsCsvModalOpen(true)
    setCsvFile(null)
    setCsvText('')
    setCsvValidationResult(null)
    setCsvImportResults(null)
    setCsvImporting(false)
    setCsvViewTab('preview')
    if (subjects.length > 0 && !csvDefaultSubject) {
      setCsvDefaultSubject(subjects[0].id)
    }
  }

  // Close CSV Import Modal
  const handleCloseCsvModal = () => {
    if (csvImporting) return
    setIsCsvModalOpen(false)
  }

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const templateContent = `question_text,option_a,option_b,option_c,option_d,correct_option_index,explanation,marks,difficulty,topic,subject_name
"What is the average time complexity of searching in a balanced Binary Search Tree?","O(1)","O(log n)","O(n)","O(n log n)",1,"In a balanced BST, tree height is O(log n), so search takes O(log n) time.",1,easy,"Binary Search Trees","Data Structures and Algorithms"
"What is the output of the following C++ code?","5","6","Undefined Behavior","Compilation Error",0,"The pointer ptr holds the address of x. Dereferencing *ptr yields value 5.",2,medium,"Pointers","C++"
"Which of the following database isolation levels prevents phantom reads?","Read Uncommitted","Read Committed","Repeatable Read","Serializable",3,"Serializable isolation provides the highest level of isolation and prevents phantom reads.",1,hard,"Transactions & ACID","DBMS"
`
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'brainvash_questions_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle CSV file selection
  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setCsvImportResults(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result || ''
      setCsvText(content)
      const res = validateAndParseCsvQuestions(content, csvDefaultSubject, subjects, questions)
      setCsvValidationResult(res)
      setCsvViewTab(res.errorCount > 0 && res.validCount === 0 ? 'errors' : 'preview')
    }
    reader.readAsText(file)
  }

  // Handle fallback subject change
  const handleFallbackSubjectChange = (newSubId) => {
    setCsvDefaultSubject(newSubId)
    if (csvText) {
      const res = validateAndParseCsvQuestions(csvText, newSubId, subjects, questions)
      setCsvValidationResult(res)
    }
  }

  // Execute sequential import via admin_save_question RPC
  const handleExecuteCsvImport = async () => {
    if (!csvValidationResult || csvValidationResult.validCount === 0) return
    const candidateRows = csvValidationResult.rows.filter(
      (r) => !r.hasError && (!skipDuplicates || !r.isDuplicate)
    )

    if (candidateRows.length === 0) {
      setError('No eligible questions to import (all rows have validation errors or are duplicates).')
      return
    }

    setCsvImporting(true)
    setCsvImportResults(null)
    setError('')
    setSuccessMsg('')

    let successCount = 0
    const failedRows = []

    for (let i = 0; i < candidateRows.length; i++) {
      const item = candidateRows[i]
      setCsvImportProgress({
        current: i + 1,
        total: candidateRows.length,
        currentText: item.question_text.slice(0, 60),
      })

      try {
        const { error: rpcErr } = await supabase.rpc('admin_save_question', {
          p_question_id: null,
          p_quiz_id: csvSelectedQuiz || null,
          p_subject_id: item.resolvedSubjectId || csvDefaultSubject || null,
          p_topic: item.topic || null,
          p_difficulty: item.difficulty || 'medium',
          p_question_text: item.question_text.trim(),
          p_code_snippet: item.code_snippet || null,
          p_options: item.options,
          p_marks: Number(item.marks) || 1,
          p_correct_option_index: Number(item.correct_option_index),
          p_explanation: item.explanation || null,
        })

        if (rpcErr) {
          failedRows.push({
            rowNumber: item.rowNumber,
            question_text: item.question_text,
            error: rpcErr.message || 'RPC execution rejected',
          })
        } else {
          successCount++
        }
      } catch (err) {
        failedRows.push({
          rowNumber: item.rowNumber,
          question_text: item.question_text,
          error: err.message || 'Client / network error',
        })
      }
    }

    setCsvImporting(false)
    setCsvImportResults({
      successCount,
      failedCount: failedRows.length,
      failedRows,
    })

    if (successCount > 0) {
      setSuccessMsg(`Successfully imported ${successCount} question(s) via secure RPC.${failedRows.length > 0 ? ` (${failedRows.length} failed)` : ''}`)
      setRefreshTrigger((prev) => prev + 1)
    } else if (failedRows.length > 0) {
      setError(`Import failed: All ${failedRows.length} attempted question(s) were rejected. See details below.`)
    }
  }

  // Update an option value
  const updateOption = (idx, value) => {
    setForm((prev) => {
      const opts = [...prev.options]
      opts[idx] = value
      return { ...prev, options: opts }
    })
  }

  const diffStyle = {
    easy: { color: '#2e7d32', bg: '#e8f5e9' },
    medium: { color: '#d84315', bg: '#fbe9e7' },
    hard: { color: '#c2185b', bg: '#fce4ec' },
  }

  return (
    <div className="dash-tab-container admin-questions-container">
      {/* Header */}
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Reusable Question Bank</h1>
          <p className="dash-page-desc">
            Author, categorize and assign MCQ items across Easy, Medium and Hard difficulty tiers. Questions are shared via the quiz_questions junction table.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleOpenCsvModal}>
            <span>📥</span> Import Questions (CSV)
          </button>
          <button className="btn-primary" onClick={handleOpenCreate}>
            <span>➕</span> New Question
          </button>
        </div>
      </div>

      {/* Difficulty Distribution Cards */}
      <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('all')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">All Questions</span>
            <span className="dash-stat-icon">🗄️</span>
          </div>
          <div className="dash-stat-value">{diffCounts.total}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('easy')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">🌱 Easy Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#2e7d32' }}>{diffCounts.easy}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('medium')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">⚡ Medium Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#d84315' }}>{diffCounts.medium}</div>
        </div>
        <div className="dash-stat-card" onClick={() => setFilterDifficulty('hard')} style={{ cursor: 'pointer' }}>
          <div className="dash-stat-top">
            <span className="dash-stat-label">🔥 Hard Tier</span>
          </div>
          <div className="dash-stat-value" style={{ color: '#c2185b' }}>{diffCounts.hard}</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="auth-message auth-success" style={{ marginBottom: 16 }}>
          ✓ {successMsg}
          <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}
      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="dash-filter-toolbar" style={{ marginBottom: 20 }}>
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search question text, topic or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button className="dash-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="dash-filter-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="dash-select" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="all">All Difficulties</option>
            <option value="easy">🌱 Easy</option>
            <option value="medium">⚡ Medium</option>
            <option value="hard">🔥 Hard</option>
          </select>
          <select className="dash-select" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="dash-loading-container">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading question bank from Supabase...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((q, idx) => {
            const ds = diffStyle[q.difficulty] || diffStyle.medium
            return (
              <div key={q.id} className="dash-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        color: ds.color, background: ds.bg,
                      }}>
                        {q.difficulty || 'medium'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#9a8a90' }}>
                        {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      </span>
                      {q.subjects?.name && (
                        <span style={{ fontSize: '0.78rem', color: '#5e4a52', background: '#faf5ef', padding: '1px 6px', borderRadius: 4 }}>
                          📚 {q.subjects.name}
                        </span>
                      )}
                      {q.topic && (
                        <span style={{ fontSize: '0.78rem', color: '#9a8a90' }}>
                          • {q.topic}
                        </span>
                      )}
                      {q.quizzes?.title && (
                        <span style={{ fontSize: '0.72rem', color: '#2e7d32', background: '#e8f5e9', padding: '1px 6px', borderRadius: 4 }}>
                          🔗 {q.quizzes.title}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#3b1f2b', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
                      <strong>Q{idx + 1}.</strong> {q.question_text}
                    </p>
                    {q.code_snippet && (
                      <pre style={{
                        background: '#2d1520', color: '#f8d7d0', padding: '10px 14px',
                        borderRadius: 8, fontSize: '0.82rem', marginTop: 8, overflowX: 'auto',
                      }}>
                        <code>{q.code_snippet}</code>
                      </pre>
                    )}
                    {/* Options preview */}
                    {Array.isArray(q.options) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 8 }}>
                        {q.options.map((opt, oi) => (
                          <span key={oi} style={{ fontSize: '0.82rem', color: '#5e4a52' }}>
                            <strong style={{ color: '#3b1f2b' }}>{String.fromCharCode(65 + oi)}.</strong> {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.82rem' }} onClick={() => handleOpenEdit(q)}>
                      Edit
                    </button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.82rem', color: '#c2185b' }} onClick={() => setDeleteConfirm(q)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🗄️</div>
          <h3>Question bank is empty</h3>
          <p>Start building your reusable assessment repository.</p>
          <button className="btn-primary" onClick={handleOpenCreate} style={{ marginTop: 12 }}>
            ➕ Create First Question
          </button>
        </div>
      )}

      {/* Create / Edit Question Modal */}
      {isFormOpen && (
        <div className="auth-modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <button className="auth-modal-close" onClick={() => setIsFormOpen(false)}>×</button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>📝</span> {editingQuestion ? 'Edit Question' : 'New MCQ Question'}
              </div>
              <h2 className="diff-modal-title">
                {editingQuestion ? 'Update Question Bank Item' : 'Author New Question'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="admin-form" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
              {/* Question Text */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Question Statement *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What is the output of the following code?"
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                />
              </div>

              {/* Code Snippet */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Code Snippet (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Paste code here if this is a code-output question..."
                  className="form-input"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={form.code_snippet}
                  onChange={(e) => setForm({ ...form, code_snippet: e.target.value })}
                />
              </div>

              {/* Four Options */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Answer Options * (Exactly 4 required)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                        fontWeight: 700, color: form.correct_option_index === idx ? '#2e7d32' : '#9a8a90', fontSize: '0.85rem',
                      }}>
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        className="form-input"
                        style={{
                          paddingLeft: 34,
                          borderColor: form.correct_option_index === idx ? '#2e7d32' : undefined,
                          background: form.correct_option_index === idx ? '#f1f8e9' : undefined,
                        }}
                        value={form.options[idx]}
                        onChange={(e) => updateOption(idx, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Answer & Marks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Correct Answer *</label>
                  <select
                    className="form-input"
                    value={form.correct_option_index}
                    onChange={(e) => setForm({ ...form, correct_option_index: Number(e.target.value) })}
                  >
                    <option value={0}>A — {form.options[0].slice(0, 20) || 'Option A'}</option>
                    <option value={1}>B — {form.options[1].slice(0, 20) || 'Option B'}</option>
                    <option value={2}>C — {form.options[2].slice(0, 20) || 'Option C'}</option>
                    <option value={3}>D — {form.options[3].slice(0, 20) || 'Option D'}</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Marks *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    className="form-input"
                    value={form.marks}
                    onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Difficulty *</label>
                  <select
                    className="form-input"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  >
                    <option value="easy">🌱 Easy</option>
                    <option value="medium">⚡ Medium</option>
                    <option value="hard">🔥 Hard</option>
                  </select>
                </div>
              </div>

              {/* Subject, Quiz, Topic */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Subject</label>
                  <select className="form-input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                    <option value="">— No Subject —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Link to Quiz</label>
                  <select className="form-input" value={form.quiz_id} onChange={(e) => setForm({ ...form, quiz_id: e.target.value })}>
                    <option value="">— Standalone (Bank Only) —</option>
                    {quizzes.map((qz) => (
                      <option key={qz.id} value={qz.id}>{qz.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Topic Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Linked Lists"
                    className="form-input"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  />
                </div>
              </div>

              {/* Explanation */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Answer Explanation (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain why the correct answer is right — shown to students post-quiz during review."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingQuestion ? 'Update Question ✓' : 'Create Question +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="auth-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <span>⚠️</span> Confirm Deletion
              </div>
              <h2 className="diff-modal-title">Delete Question</h2>
            </div>
            <p style={{ color: '#5e4a52', marginBottom: 20 }}>
              Permanently delete: <strong>{deleteConfirm.question_text?.slice(0, 80)}...</strong>?
              This will also remove its answer key.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: '#c2185b', borderColor: '#c2185b' }} disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="auth-modal-overlay" onClick={handleCloseCsvModal}>
          <div
            className="auth-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 880, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <button className="auth-modal-close" onClick={handleCloseCsvModal} disabled={csvImporting}>×</button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge" style={{ background: '#eef2ff', color: '#3730a3' }}>
                <span>📥</span> Bulk Question Import
              </div>
              <h2 className="diff-modal-title">Import Questions (CSV)</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#5e4a52' }}>
                Batch author questions using a structured CSV file. All questions and answer keys are saved via secure RPC.
              </p>
            </div>

            {/* Subject and Quiz Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16, background: '#fbf8f5', padding: 14, borderRadius: 10, border: '1px solid #f3e0d5' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Fallback / Default Subject *
                </label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  value={csvDefaultSubject}
                  onChange={(e) => handleFallbackSubjectChange(e.target.value)}
                  disabled={csvImporting}
                >
                  <option value="">— Select Fallback Subject —</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.code ? `(${sub.code})` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#7a6a70', display: 'block', marginTop: 4 }}>
                  Used when subject_name is empty or doesn't match a curriculum subject.
                </span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Assign to Quiz (Optional)
                </label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  value={csvSelectedQuiz}
                  onChange={(e) => setCsvSelectedQuiz(e.target.value)}
                  disabled={csvImporting}
                >
                  <option value="">— Standalone (Bank Only, quiz_id = null) —</option>
                  {quizzes.map((qz) => (
                    <option key={qz.id} value={qz.id}>
                      {qz.title}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#7a6a70', display: 'block', marginTop: 4 }}>
                  If selected, questions are linked directly to this quiz.
                </span>
              </div>
            </div>

            {/* Upload Area & Template Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#3b1f2b', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    disabled={csvImporting}
                  />
                  Skip duplicate questions (Recommended)
                </label>
              </div>

              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                onClick={handleDownloadTemplate}
              >
                📄 Download CSV Template
              </button>
            </div>

            {/* File Drop/Input Area */}
            <div style={{
              border: '2px dashed #f3e0d5',
              borderRadius: 10,
              padding: '16px 20px',
              textAlign: 'center',
              background: '#ffffff',
              marginBottom: 16,
            }}>
              <input
                type="file"
                id="csvFileInput"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleCsvFileChange}
                disabled={csvImporting}
              />
              <label htmlFor="csvFileInput" style={{ cursor: 'pointer', display: 'block' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>📁</div>
                <span style={{ color: '#e8634a', fontWeight: 600, fontSize: '0.92rem' }}>
                  {csvFile ? `Selected: ${csvFile.name}` : 'Click here to choose a CSV file'}
                </span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#7a6a70', marginTop: 4 }}>
                  Expected columns: question_text, option_a, option_b, option_c, option_d, correct_option_index, explanation, marks, difficulty, topic, subject_name
                </span>
              </label>
            </div>

            {/* Parsing & Validation Summary */}
            {csvValidationResult && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ padding: '4px 10px', background: '#f5f5f5', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, color: '#3b1f2b' }}>
                    Total Rows: {csvValidationResult.rows.length}
                  </span>
                  <span style={{ padding: '4px 10px', background: '#e8f5e9', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, color: '#2e7d32' }}>
                    ✓ Ready: {csvValidationResult.validCount}
                  </span>
                  {csvValidationResult.errorCount > 0 && (
                    <span style={{ padding: '4px 10px', background: '#fce4ec', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, color: '#c2185b' }}>
                      ⚠️ Errors: {csvValidationResult.errorCount}
                    </span>
                  )}
                  {csvValidationResult.duplicateCount > 0 && (
                    <span style={{ padding: '4px 10px', background: '#fff8e1', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, color: '#f57f17' }}>
                      🔁 Duplicates: {csvValidationResult.duplicateCount}
                    </span>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`dash-cat-pill ${csvViewTab === 'preview' ? 'active' : ''}`}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      onClick={() => setCsvViewTab('preview')}
                    >
                      Preview Rows ({csvValidationResult.rows.length})
                    </button>
                    {csvValidationResult.errorCount > 0 && (
                      <button
                        type="button"
                        className={`dash-cat-pill ${csvViewTab === 'errors' ? 'active' : ''}`}
                        style={{ fontSize: '0.78rem', padding: '4px 10px', color: '#c2185b' }}
                        onClick={() => setCsvViewTab('errors')}
                      >
                        Errors ({csvValidationResult.errorCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Validation Errors Tab */}
                {csvViewTab === 'errors' && csvValidationResult.errorCount > 0 && (
                  <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 8, padding: 12 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#c2185b' }}>Validation Issues Found:</h4>
                    {csvValidationResult.errors.map((errItem, idx) => (
                      <div key={idx} style={{ fontSize: '0.82rem', color: '#3b1f2b', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #ffebee' }}>
                        <strong>Row {errItem.row}:</strong> <span style={{ color: '#5e4a52' }}>"{errItem.text?.slice(0, 60)}..."</span>
                        <ul style={{ margin: '3px 0 0 16px', padding: 0, color: '#c2185b' }}>
                          {errItem.errors.map((msg, mi) => (
                            <li key={mi}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview Table Tab */}
                {csvViewTab === 'preview' && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #f3e0d5', borderRadius: 8 }}>
                    <table className="dash-table" style={{ fontSize: '0.8rem', margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>Question</th>
                          <th>Options (A, B, C, D)</th>
                          <th>Correct</th>
                          <th>Diff</th>
                          <th>Marks</th>
                          <th>Subject</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvValidationResult.rows.map((row) => (
                          <tr key={row.rowNumber} style={{ opacity: row.hasError || (skipDuplicates && row.isDuplicate) ? 0.65 : 1 }}>
                            <td>{row.rowNumber}</td>
                            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.question_text}>
                              {row.question_text || <span style={{ color: '#c2185b', fontStyle: 'italic' }}>Missing</span>}
                            </td>
                            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              A: {row.options[0]}, B: {row.options[1]}, C: {row.options[2]}, D: {row.options[3]}
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, color: row.correct_option_index >= 0 ? '#2e7d32' : '#c2185b' }}>
                                {row.correct_option_index >= 0 ? `${row.correct_option_index} (${String.fromCharCode(65 + row.correct_option_index)})` : 'Invalid'}
                              </span>
                            </td>
                            <td>
                              <span className={`dash-quiz-diff diff-${row.difficulty}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                {row.difficulty}
                              </span>
                            </td>
                            <td>{row.marks}</td>
                            <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.subject_name || <span style={{ color: '#c2185b' }}>None</span>}
                            </td>
                            <td>
                              {row.hasError ? (
                                <span style={{ color: '#c2185b', fontWeight: 600, fontSize: '0.75rem' }}>❌ Error</span>
                              ) : row.isDuplicate ? (
                                <span style={{ color: '#f57f17', fontWeight: 600, fontSize: '0.75rem' }} title={row.duplicateReason}>
                                  🔁 {skipDuplicates ? 'Skipped' : 'Duplicate'}
                                </span>
                              ) : (
                                <span style={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.75rem' }}>✓ Valid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar during sequential import */}
            {csvImporting && (
              <div style={{ margin: '14px 0', padding: 14, background: '#fbf8f5', borderRadius: 8, border: '1px solid #f3e0d5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#3b1f2b' }}>
                  <span>Importing sequentially via RPC...</span>
                  <span>{csvImportProgress.current} / {csvImportProgress.total}</span>
                </div>
                <div style={{ background: '#f3e0d5', borderRadius: 999, height: 8, overflow: 'hidden', margin: '8px 0 6px' }}>
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #e8634a, #d84315)',
                      height: '100%',
                      width: `${csvImportProgress.total > 0 ? (csvImportProgress.current / csvImportProgress.total) * 100 : 0}%`,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.78rem', color: '#7a6a70', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  Current: {csvImportProgress.currentText}
                </span>
              </div>
            )}

            {/* Results Summary after Import */}
            {csvImportResults && (
              <div style={{ margin: '12px 0', padding: 14, background: '#fbf8f5', borderRadius: 8, border: '1px solid #f3e0d5' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: '#2e7d32' }}>
                  ✓ Import Completed: {csvImportResults.successCount} saved successfully
                </h4>
                {csvImportResults.failedCount > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c2185b' }}>
                      ⚠️ {csvImportResults.failedCount} question(s) failed to save:
                    </span>
                    <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 6 }}>
                      {csvImportResults.failedRows.map((fail, idx) => (
                        <div key={idx} style={{ fontSize: '0.8rem', color: '#c2185b', marginBottom: 4 }}>
                          • Row {fail.rowNumber}: "{fail.question_text?.slice(0, 50)}..." — <em>{fail.error}</em>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={csvImporting}
                onClick={handleCloseCsvModal}
              >
                {csvImportResults ? 'Close' : 'Cancel'}
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={
                  csvImporting ||
                  !csvValidationResult ||
                  csvValidationResult.rows.filter((r) => !r.hasError && (!skipDuplicates || !r.isDuplicate)).length === 0
                }
                onClick={handleExecuteCsvImport}
              >
                {csvImporting
                  ? `Importing (${csvImportProgress.current}/${csvImportProgress.total})...`
                  : `Import ${csvValidationResult
                    ? csvValidationResult.rows.filter((r) => !r.hasError && (!skipDuplicates || !r.isDuplicate)).length
                    : 0
                  } Questions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
