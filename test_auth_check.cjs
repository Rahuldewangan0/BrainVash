const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  // Try signing in with any test accounts that might exist
  const testEmails = [
    'admin@brainvash.com',
    'admin@gmail.com',
    'rahuldewangan@gmail.com',
    'test@gmail.com',
    'student@gmail.com'
  ];

  for (const email of testEmails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'Password123!',
    });
    if (!error && data.user) {
      console.log(`Signed in successfully as: ${email}, ID: ${data.user.id}`);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      console.log('Profile:', prof);
      return;
    }
  }
  console.log('No default test user signed in.');
}

check();
