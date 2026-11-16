const fs = require('fs');

const files = [
  'supabase/migrations/20261115_initial_schema.sql',
  'supabase/migrations/20261116_phase2_admin_and_difficulty.sql',
  'supabase/migrations/20261116_phase2_rollback.sql'
];

let hasError = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Count $$ dollar quotes
  const dollarPairs = (content.match(/\$\$/g) || []).length;
  if (dollarPairs % 2 !== 0) {
    console.error(`FAIL: ${file} has unbalanced $$ quotes (count: ${dollarPairs})`);
    hasError = true;
  } else {
    console.log(`PASS: ${file} dollar quotes balanced (${dollarPairs / 2} pairs)`);
  }

  // Check transactional blocks
  const hasBegin = /^\s*BEGIN\s*;/m.test(content);
  const hasCommit = /^\s*COMMIT\s*;/m.test(content);
  if (file.includes('phase2')) {
    if (!hasBegin || !hasCommit) {
      console.error(`FAIL: ${file} missing top-level BEGIN/COMMIT transaction`);
      hasError = true;
    } else {
      console.log(`PASS: ${file} has transactional wrapper BEGIN; ... COMMIT;`);
    }
  }

  // Check for search_path on every SECURITY DEFINER function
  const secDefRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)\s*\(([^)]*)\)[\s\S]*?SECURITY\s+DEFINER[\s\S]*?(?:SET\s+search_path\s*=\s*([^;]+);|\$\$)/gi;
  let match;
  while ((match = secDefRegex.exec(content)) !== null) {
    const fnName = match[1];
    const fullHeader = match[0];
    if (!fullHeader.toLowerCase().includes('search_path')) {
      console.error(`WARN/FAIL: ${file} function ${fnName} has SECURITY DEFINER without search_path!`);
      hasError = true;
    }
  }
}

if (!hasError) {
  console.log('ALL MIGRATION SQL SYNTAX CHECKS PASSED!');
  process.exit(0);
} else {
  process.exit(1);
}
