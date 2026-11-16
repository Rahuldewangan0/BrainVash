const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function testSignup() {
  const email = `teststudent_${Date.now()}@gmail.com`;
  const password = 'Password123!';
  console.log('Signing up with:', email);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Student',
        college_name: 'Test Engineering College',
        branch: 'Computer Science & Engineering',
        semester: 4,
      }
    }
  });

  if (error) {
    console.error('Signup error:', error.message);
    return;
  }

  console.log('User signed up! ID:', data.user ? data.user.id : 'No user object (check email confirmation setting)');
  if (data.session) {
    console.log('Session active immediately!');
    // Fetch profile
    const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    console.log('Profile created:', profErr ? profErr.message : prof);
  } else {
    console.log('No session immediately — Supabase email confirmation might be required.');
  }
}

testSignup();
