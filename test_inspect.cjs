const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Connecting to:', supabaseUrl);

  const { data: colleges, error: e1 } = await supabase.from('colleges').select('*').limit(2);
  console.log('Colleges:', e1 ? e1.message : colleges);

  const { data: subjects, error: e2 } = await supabase.from('subjects').select('*').limit(2);
  console.log('Subjects:', e2 ? e2.message : subjects);

  const { data: quizzes, error: e3 } = await supabase.from('quizzes').select('*').limit(2);
  console.log('Quizzes sample:', e3 ? e3.message : quizzes);

  const { data: questions, error: e4 } = await supabase.from('questions').select('*').limit(2);
  console.log('Questions sample:', e4 ? e4.message : questions);

  const { data: quiz_questions, error: e5 } = await supabase.from('quiz_questions').select('*').limit(2);
  console.log('quiz_questions table exists?:', e5 ? e5.message : quiz_questions);

  const { data: profiles, error: e6 } = await supabase.from('profiles').select('id, full_name, is_admin').limit(5);
  console.log('Profiles (anon):', e6 ? e6.message : profiles);
}

run();
