const { Pool } = require('pg');

const pool = new Pool({
  user: 'recruiter',
  password: 'recruiter_pass',
  host: 'localhost',
  database: 'ai_recruiter', // Changed to the correct database name
  port: 5432,
});

async function run() {
  try {
    console.log("Checking database 'ai_recruiter' with user 'recruiter'...");
    await pool.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_email_key;');
    console.log("✅ SUCCESS: Email constraint removed from ai_recruiter!");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  } finally {
    await pool.end();
  }
}

run();