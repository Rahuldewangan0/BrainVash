const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function testAllAdminQueries() {
  console.log('--- 1. Testing AdminOverview Queries ---');
  const q1 = await supabase.from('quizzes').select('id, is_published');
  console.log('Quizzes for overview:', q1.error ? q1.error.message : `OK (${q1.data.length})`);

  const q2 = await supabase.from('questions').select('id, difficulty');
  console.log('Questions for overview:', q2.error ? q2.error.message : `OK (${q2.data.length})`);

  const q3 = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  console.log('Profiles count:', q3.error ? q3.error.message : `OK (${q3.count})`);

  const q4 = await supabase.from('quiz_attempts').select(`
    id, status, score, total_marks, accuracy_percentage, selected_difficulty, started_at, completed_at, user_id, quiz_id
  `).order('started_at', { ascending: false }).limit(5);
  console.log('Attempts for overview:', q4.error ? q4.error.message : `OK (${q4.data.length})`);

  console.log('\n--- 2. Testing SubjectManagement Query ---');
  const s1 = await supabase.from('subjects').select('*').order('semester', { ascending: true, nullsFirst: false });
  console.log('SubjectManagement select:', s1.error ? s1.error.message : `OK (${s1.data.length})`);

  console.log('\n--- 3. Testing QuizManagement Query ---');
  const qz1 = await supabase.from('quizzes').select(`
    id, title, slug, description, subject_id, semester, branch, difficulty, time_limit_minutes, total_questions, total_marks, passing_score, negative_marks, max_attempts, is_published, is_daily_challenge, created_at, subjects(id, name, code)
  `);
  console.log('QuizManagement select:', qz1.error ? qz1.error.message : `OK (${qz1.data.length})`);

  console.log('\n--- 4. Testing QuestionBank Query ---');
  const qb1 = await supabase.from('questions').select(`
    id, quiz_id, subject_id, question_text, question_type, code_snippet, options, marks, difficulty, topic, order_index, created_at, subjects(id, name, code), quizzes(id, title)
  `);
  console.log('QuestionBank select:', qb1.error ? qb1.error.message : `OK (${qb1.data.length})`);

  console.log('\n--- 5. Testing StudentManagement Query ---');
  const sm1 = await supabase.from('profiles').select('id, full_name, college_name, branch, semester, avatar_url, is_admin, total_score, weekly_score, quizzes_attempted, created_at');
  console.log('StudentManagement select (anon):', sm1.error ? sm1.error.message : `OK (${sm1.data.length})`);
}

testAllAdminQueries();
