const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function checkColumns() {
  // Test query on subjects
  const { error: sErr } = await supabase.from('subjects').select('id, name, code, category, icon, description, semester, branch, is_active').limit(1);
  console.log('Subjects query with Phase 2 columns error:', sErr ? sErr.message : 'SUCCESS');

  // Test query on quizzes
  const { error: qErr } = await supabase.from('quizzes').select('id, title, slug, description, subject_id, difficulty, time_limit_minutes, total_questions, total_marks, passing_score, is_published, is_daily_challenge, semester, branch, negative_marks, max_attempts').limit(1);
  console.log('Quizzes query with Phase 2 columns error:', qErr ? qErr.message : 'SUCCESS');

  // Test query on questions
  const { error: questErr } = await supabase.from('questions').select('id, quiz_id, subject_id, topic, difficulty, question_text, code_snippet, options, marks').limit(1);
  console.log('Questions query with Phase 2 columns error:', questErr ? questErr.message : 'SUCCESS');

  // Test query on quiz_attempts
  const { error: attErr } = await supabase.from('quiz_attempts').select('id, selected_difficulty').limit(1);
  console.log('Quiz_attempts query with selected_difficulty error:', attErr ? attErr.message : 'SUCCESS');
}

checkColumns();
