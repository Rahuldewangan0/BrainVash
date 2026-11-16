const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function testSecurity() {
  console.log('--- 1. Testing Self-Promotion via RPC ---');
  const { data: rpcData, error: rpcErr } = await supabase.rpc('promote_user_to_admin', {
    p_user_email: 'teststudent_1794778007640@gmail.com'
  });
  console.log('promote_user_to_admin result (anon/client):', rpcErr ? `BLOCKED (${rpcErr.message})` : rpcData);

  console.log('--- 2. Testing Direct Profile is_admin Tampering ---');
  // Sign in as student
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'teststudent_1794778007640@gmail.com',
    password: 'Password123!',
  });
  
  if (authData.session) {
    const studentClient = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    const { data: updateData, error: updateErr } = await studentClient
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', authData.user.id)
      .select();

    console.log('Direct update is_admin=true result:', updateErr ? `BLOCKED (${updateErr.message})` : updateData);
    
    // Check if is_admin is still false
    const { data: checkProf } = await studentClient.from('profiles').select('is_admin').eq('id', authData.user.id).single();
    console.log('is_admin current value:', checkProf.is_admin);

    console.log('--- 3. Testing Direct Question Answer Key Access ---');
    const { data: keysData, error: keysErr } = await studentClient
      .from('question_answer_keys')
      .select('*');
    console.log('Student query question_answer_keys:', keysErr ? `BLOCKED (${keysErr.message})` : keysData);

    console.log('--- 4. Testing Student Unauthorized Insert on Quizzes ---');
    const { data: qzData, error: qzErr } = await studentClient
      .from('quizzes')
      .insert({
        title: 'Hacked Quiz',
        slug: 'hacked-quiz',
        time_limit_minutes: 10,
        total_questions: 5,
        passing_score: 50
      });
    console.log('Student insert into quizzes:', qzErr ? `BLOCKED (${qzErr.message})` : qzData);
  }
}

testSecurity();
