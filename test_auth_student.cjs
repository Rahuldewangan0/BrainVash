const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function testAuthStudentQueries() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teststudent_1794778007640@gmail.com',
    password: 'Password123!',
  });

  if (authErr) {
    console.error('Sign in error:', authErr.message);
    return;
  }

  const studentClient = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  console.log('Testing student quiz attempts query...');
  const { data: atts, error: attErr } = await studentClient.from('quiz_attempts').select(`
    id, status, score, total_marks, accuracy_percentage, started_at, completed_at, user_id, quiz_id,
    quizzes ( id, title, subjects ( name ) )
  `).eq('user_id', authData.user.id);

  console.log('Student quiz attempts:', attErr ? attErr.message : `SUCCESS, length: ${atts.length}`);
}

testAuthStudentQueries();
