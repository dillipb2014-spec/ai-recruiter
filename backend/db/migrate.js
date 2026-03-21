require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    try {
      await pool.query(sql);
      console.log(`✓ ${file}`);
    } catch (err) {
      // Ignore "already exists" errors — idempotent
      if (err.code === "42P07" || err.code === "42710" || err.message.includes("already exists")) {
        console.log(`~ ${file} (already applied)`);
      } else {
        console.error(`✗ ${file}: ${err.message}`);
      }
    }
  }

  await pool.end();
  console.log("Migrations complete.");
}

migrate().catch((e) => { console.error(e); process.exit(1); });
