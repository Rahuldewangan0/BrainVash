const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function testResilientQueries() {
  console.log('--- 1. Testing Resilient Subjects Query ---');
  // Order by name
  const res1 = await supabase.from('subjects').select('*').order('name');
  console.log('Subjects order by name:', res1.error ? res1.error.message : 'SUCCESS, length: ' + res1.data.length);

  console.log('--- 2. Testing Resilient Quizzes Query ---');
  // In Phase 1 schema, quizzes has: id, subject_id, title, slug, description, difficulty, time_limit_minutes, total_questions, passing_score, is_daily_challenge, daily_challenge_date, is_published, created_at
  // If we try to select 'semester' or 'total_marks' when not migrated, it errors.
  // So we can select standard columns or fallback gracefully!
  let { data: qzData, error: qzErr } = await supabase.from('quizzes').select(`
    id, title, slug, description, subject_id, difficulty, time_limit_minutes, total_questions, passing_score, is_published, is_daily_challenge, created_at, subjects(id, name, code)
  `);
  console.log('Quizzes with base schema:', qzErr ? qzErr.message : 'SUCCESS, length: ' + qzData.length);

  console.log('--- 3. Testing Resilient Questions Query ---');
  // In Phase 1, questions has: id, quiz_id, question_text, question_type, code_snippet, options, marks, order_index, created_at
  // subjects relationship only exists if subject_id is a FK. In Phase 1, questions links to quizzes(id), and quizzes links to subjects(id).
  // So questions -> quizzes -> subjects!
  let { data: qData, error: qErr } = await supabase.from('questions').select(`
    id, quiz_id, question_text, question_type, code_snippet, options, marks, order_index, created_at, quizzes(id, title, subjects(id, name, code))
  `);
  console.log('Questions linked through quizzes.subjects:', qErr ? qErr.message : 'SUCCESS, length: ' + qData.length);

  console.log('--- 4. Testing Resilient Attempts Query ---');
  let { data: attData, error: attErr } = await supabase.from('quiz_attempts').select(`
    id, status, score, total_marks, accuracy_percentage, started_at, completed_at, user_id, quiz_id,
    quizzes(id, title, subjects(name))
  `);
  console.log('Attempts with base schema:', attErr ? attErr.message : 'SUCCESS, length: ' + attData.length);
}

testResilientQueries();
