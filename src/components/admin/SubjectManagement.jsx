import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterSemester, setFilterSemester] = useState('all')
  const [filterActive, setFilterActive] = useState('all')

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null) // null = create, object = edit
  const [saving, setSaving] = useState(false)
  const [deleteConfirmSubject, setDeleteConfirmSubject] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [associatedQuizzesCount, setAssociatedQuizzesCount] = useState(0)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'core_cs',
    semester: 3,
    branch: 'Computer Science & Engineering',
    description: '',
    icon: '💻',
    is_active: true,
  })

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'core_cs', label: 'Core CS' },
    { id: 'programming', label: 'Programming' },
    { id: 'college_syllabus', label: 'College Syllabus' },
    { id: 'aptitude', label: 'Aptitude & Reasoning' },
    { id: 'contests', label: 'Contests & Placement' },
  ]

  const branches = [
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical Engineering',
    'Common / First Year',
  ]

  // Fetch subjects from Supabase
  useEffect(() => {
    let ignore = false

    async function loadSubjects() {
      if (!supabase) return
      setLoading(true)
      setError('')
      try {
        // Try ordering by semester then name
        let loaded = []
        const res1 = await supabase
          .from('subjects')
          .select('*')
          .order('semester', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true })

        if (!res1.error) {
          loaded = res1.data || []
        } else {
          // Fallback ordering by name if semester column is not yet present
          const res2 = await supabase
            .from('subjects')
            .select('*')
            .order('name', { ascending: true })

          if (res2.error) throw new Error(res2.error.message)
          loaded = res2.data || []
        }

        if (!ignore) {
          setSubjects(loaded)
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load curriculum subjects.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadSubjects()
    return () => {
      ignore = true
    }
  }, [refreshTrigger])

  // Filtered list
  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      // Category filter
      if (filterCategory !== 'all' && sub.category !== filterCategory) return false

      // Semester filter
      if (filterSemester !== 'all' && Number(sub.semester) !== Number(filterSemester)) return false

      // Active status filter
      if (filterActive !== 'all') {
        const isActive = sub.is_active !== false // default true
        if (filterActive === 'active' && !isActive) return false
        if (filterActive === 'inactive' && isActive) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = sub.name?.toLowerCase().includes(q)
        const codeMatch = sub.code?.toLowerCase().includes(q)
        const branchMatch = sub.branch?.toLowerCase().includes(q)
        if (!nameMatch && !codeMatch && !branchMatch) return false
      }

      return true
    })
  }, [subjects, filterCategory, filterSemester, filterActive, searchQuery])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingSubject(null)
    setFormData({
      name: '',
      code: '',
      category: 'core_cs',
      semester: 3,
      branch: 'Computer Science & Engineering',
      description: '',
      icon: '💻',
      is_active: true,
    })
    setIsModalOpen(true)
    setError('')
  }

  // Open Edit Modal
  const handleOpenEdit = (subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      category: subject.category || 'core_cs',
      semester: subject.semester || 3,
      branch: subject.branch || 'Computer Science & Engineering',
      description: subject.description || '',
      icon: subject.icon || '💻',
      is_active: subject.is_active !== false,
    })
    setIsModalOpen(true)
    setError('')
  }

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Subject name is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccessMsg('')

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase() || null,
        category: formData.category,
        semester: Number(formData.semester) || 1,
        branch: formData.branch,
        description: formData.description.trim() || null,
        icon: formData.icon.trim() || '📚',
        is_active: formData.is_active,
      }

      if (editingSubject) {
        // UPDATE (try full payload first)
        let { error: updateErr } = await supabase
          .from('subjects')
          .update(payload)
          .eq('id', editingSubject.id)

        if (updateErr && (updateErr.message.includes('column') || updateErr.message.includes('does not exist'))) {
          // Fallback for Phase 1 schema without semester/branch/is_active
          const basePayload = {
            name: payload.name,
            code: payload.code,
            category: payload.category,
            description: payload.description,
            icon: payload.icon,
          }
          const resBase = await supabase
            .from('subjects')
            .update(basePayload)
            .eq('id', editingSubject.id)

          updateErr = resBase.error
        }

        if (updateErr) {
          if (updateErr.message.includes('permission denied')) {
            throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level UPDATE grants on subjects. Deploying the Phase 2 migration will grant full admin permissions.`)
          }
          throw new Error(updateErr.message)
        }
        setSuccessMsg(`Subject "${payload.name}" updated successfully.`)
      } else {
        // CREATE (try full payload first)
        let { error: insertErr } = await supabase
          .from('subjects')
          .insert([payload])

        if (insertErr && (insertErr.message.includes('column') || insertErr.message.includes('does not exist'))) {
          // Fallback for Phase 1 schema without semester/branch/is_active
          const basePayload = {
            name: payload.name,
            code: payload.code,
            category: payload.category,
            description: payload.description,
            icon: payload.icon,
          }
          const resBase = await supabase
            .from('subjects')
            .insert([basePayload])

          insertErr = resBase.error
        }

        if (insertErr) {
          if (insertErr.message.includes('permission denied')) {
            throw new Error(`Database Permission Notice: The 'authenticated' role currently lacks table-level INSERT grants on subjects. Deploying the Phase 2 migration will grant full admin permissions.`)
          }
          throw new Error(insertErr.message)
        }
        setSuccessMsg(`Subject "${payload.name}" created successfully.`)
      }

      setIsModalOpen(false)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(err.message || 'Error saving subject.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle is_active directly from table
  const handleToggleActive = async (subject) => {
    const nextStatus = subject.is_active === false ? true : false
    try {
      const { error: updateErr } = await supabase
        .from('subjects')
        .update({ is_active: nextStatus })
        .eq('id', subject.id)

      if (updateErr) {
        if (updateErr.message.includes('column') || updateErr.message.includes('does not exist')) {
          setError(`Notice: The 'is_active' column requires applying the Phase 2 database migration.`)
          return
        }
        throw new Error(updateErr.message)
      }
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, is_active: nextStatus } : s))
      )
    } catch (err) {
      setError(`Failed to update status for ${subject.name}: ${err.message}`)
    }
  }

  // Prompt Delete
  const handlePromptDelete = async (subject) => {
    setDeleteConfirmSubject(subject)
    setAssociatedQuizzesCount(0)

    // Check if quizzes use this subject
    try {
      const { count } = await supabase
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subject.id)

      setAssociatedQuizzesCount(count || 0)
    } catch (chkErr) {
      console.warn('[SubjectManagement] Check associated quizzes notice:', chkErr.message)
    }
  }

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirmSubject) return
    setDeleting(true)
    setError('')
    setSuccessMsg('')

    try {
      const { error: delErr } = await supabase
        .from('subjects')
        .delete()
        .eq('id', deleteConfirmSubject.id)

      if (delErr) throw new Error(delErr.message)

      setSuccessMsg(`Subject "${deleteConfirmSubject.name}" deleted.`)
      setDeleteConfirmSubject(null)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      setError(`Cannot delete subject: ${err.message}. If quizzes are linked to this subject, consider setting its status to Inactive instead.`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="dash-tab-container admin-subjects-container">
      {/* Header */}
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Curriculum Subject Management</h1>
          <p className="dash-page-desc">
            Organize engineering disciplines, semester syllabi, subject codes, and student enrollment tags.
          </p>
        </div>

        <div>
          <button className="btn-primary" onClick={handleOpenCreate}>
            <span>➕</span> Add New Subject
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="auth-message auth-success" style={{ marginBottom: 16 }}>
          <span>✓ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="dash-filter-toolbar" style={{ marginBottom: 20 }}>
        {/* Search */}
        <div className="dash-search-box">
          <span className="dash-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search subjects by name, code or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search-input"
          />
          {searchQuery && (
            <button className="dash-search-clear" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="dash-filter-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Category */}
          <select
            className="dash-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Semester */}
          <select
            className="dash-select"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
          >
            <option value="all">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            className="dash-select"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Subjects Table */}
      {loading ? (
        <div className="dash-loading-container">
          <span className="spinner" style={{ borderColor: 'rgba(232, 99, 74, 0.3)', borderTopColor: '#e8634a' }} />
          <p>Loading curriculum subjects from Supabase...</p>
        </div>
      ) : filteredSubjects.length > 0 ? (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Semester</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sub) => {
                  const isActive = sub.is_active !== false
                  return (
                    <tr key={sub.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.4rem' }}>{sub.icon || '📚'}</span>
                          <div>
                            <strong style={{ color: '#3b1f2b', display: 'block' }}>{sub.name}</strong>
                            {sub.description && (
                              <span style={{ fontSize: '0.8rem', color: '#9a8a90' }}>
                                {sub.description.slice(0, 50)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ background: '#f3e0d5', padding: '2px 6px', borderRadius: 4, color: '#3b1f2b' }}>
                          {sub.code || 'N/A'}
                        </code>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                          {sub.category?.replace('_', ' ') || 'General'}
                        </span>
                      </td>
                      <td>
                        <span className="dash-quiz-diff" style={{ background: '#faf5ef', color: '#3b1f2b' }}>
                          Sem {sub.semester || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#5e4a52' }}>
                        {sub.branch || 'Engineering'}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(sub)}
                          className={`dash-status-badge ${isActive ? 'status-completed' : 'status-abandoned'}`}
                          title="Click to toggle active status"
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                            onClick={() => handleOpenEdit(sub)}
                            title="Edit subject details"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.85rem', color: '#c2185b' }}
                            onClick={() => handlePromptDelete(sub)}
                            title="Delete subject"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">📚</div>
          <h3>No subjects match your filter</h3>
          <p>Try clearing your search query or add a new subject to the curriculum.</p>
          <button className="btn-primary" onClick={handleOpenCreate} style={{ marginTop: 12 }}>
            ➕ Create First Subject
          </button>
        </div>
      )}

      {/* Modal: Create / Edit Subject */}
      {isModalOpen && (
        <div className="auth-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <button className="auth-modal-close" onClick={() => setIsModalOpen(false)}>
              ×
            </button>

            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge">
                <span>📚</span> {editingSubject ? 'Update Curriculum Subject' : 'New Curriculum Subject'}
              </div>
              <h2 className="diff-modal-title">
                {editingSubject ? `Edit: ${editingSubject.name}` : 'Create Engineering Subject'}
              </h2>
            </div>

            <form onSubmit={handleSave} className="admin-form">
              {/* Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Subject Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CS301"
                    className="form-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
              </div>

              {/* Category & Semester */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="core_cs">Core CS</option>
                    <option value="programming">Programming</option>
                    <option value="college_syllabus">College Syllabus</option>
                    <option value="aptitude">Aptitude & Reasoning</option>
                    <option value="contests">Contests & Placement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <select
                    className="form-input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch & Icon */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Engineering Branch</label>
                  <select
                    className="form-input"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Icon / Emoji</label>
                  <input
                    type="text"
                    placeholder="💻"
                    className="form-input"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Description / Syllabus Scope</label>
                <textarea
                  rows={3}
                  placeholder="Outline syllabus modules, target topics, and key areas covered..."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="sub_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8634a' }}
                />
                <label htmlFor="sub_is_active" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#3b1f2b' }}>
                  <strong>Active in Catalog</strong> (Students can view and practice quizzes for this subject)
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingSubject ? 'Update Subject ✓' : 'Create Subject +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSubject && (
        <div className="auth-modal-overlay" onClick={() => setDeleteConfirmSubject(null)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="diff-modal-header" style={{ marginBottom: 16 }}>
              <div className="diff-header-badge" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <span>⚠️</span> Confirm Deletion
              </div>
              <h2 className="diff-modal-title">Delete Subject</h2>
            </div>

            <p style={{ color: '#5e4a52', marginBottom: 16 }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmSubject.name}</strong> ({deleteConfirmSubject.code || 'No Code'})?
            </p>

            {associatedQuizzesCount > 0 && (
              <div className="auth-message auth-error" style={{ marginBottom: 16 }}>
                <strong>Warning:</strong> {associatedQuizzesCount} quizzes are currently attached to this subject. Deleting this subject may be rejected by foreign key constraints. Consider setting this subject to <strong>Inactive</strong> instead.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmSubject(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#c2185b', borderColor: '#c2185b' }}
                disabled={deleting}
                onClick={handleExecuteDelete}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
