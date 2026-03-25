const db   = require("../db");
const XLSX = require("xlsx");
const { execFile } = require("child_process");

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";

function getAIScreenURL() {
  const base = process.env.AI_SERVICE_URL || "http://localhost:8000";
  const normalized = base.startsWith("http") ? base : `https://${base}`;
  return new URL("/screen-resume", normalized).toString();
}

function toDriveDirectUrl(url) {
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&confirm=t&id=${openMatch[1]}`;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/uc?export=download&confirm=t&id=${fileMatch[1]}`;
  return url;
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    execFile("curl", [
      "-L", "--max-redirs", "10",
      "-A", "Mozilla/5.0",
      "-b", "download_warning=t",
      "-s", "--output", "-",
      url
    ], { timeout: 30000, maxBuffer: 20 * 1024 * 1024, encoding: "buffer" }, (err, stdout) => {
      if (err) return reject(err);
      if (!stdout || stdout.length < 1000) return reject(new Error("Downloaded file too small — Drive link may not be public"));
      if (stdout.slice(0, 5).toString("ascii") !== "%PDF-") return reject(new Error("Not a PDF — Drive link may require login"));
      resolve(stdout);
    });
  });
}

async function bulkUpload(req, res) {
  const { roleId } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const role = await db.query("SELECT id, title FROM job_roles WHERE id = $1", [roleId]);
  if (!role.rows.length) return res.status(404).json({ error: "Job role not found" });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } catch {
    return res.status(400).json({ error: "Invalid Excel file" });
  }

  if (!rows.length) return res.status(400).json({ error: "Excel sheet is empty" });

  const bulkResult = await db.query(
    `INSERT INTO bulk_uploads (job_role_id, file_name, total_rows, status)
     VALUES ($1, $2, $3, 'processing') RETURNING id`,
    [roleId, req.file.originalname, rows.length]
  );
  const bulkId = bulkResult.rows[0].id;

  res.status(202).json({ message: "Bulk upload started", bulk_id: bulkId, total: rows.length });

  processBulkRows(bulkId, rows, roleId, role.rows[0].title).catch((err) =>
    console.error("Bulk processing error:", err.message)
  );
}

async function processBulkRows(bulkId, rows, roleId, jobTitle) {
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const full_name        = String(row["Name"]              || row["full_name"]    || "").trim();
      const email            = String(row["Email"]             || row["email"]        || "").trim().toLowerCase();
      const phone            = String(row["Phone"]             || row["phone"]        || "").trim();
      const currentLocation  = String(row["Current_Location"]  || row["currentLocation"] || row["location"] || "").trim();
      const noticePeriod     = String(row["Notice_Period"]     || row["noticePeriod"]  || row["notice_period"] || "").trim();
      const currentCompany   = String(row["Current_Company"]   || row["currentCompany"] || row["current_company"] || "").trim();
      const yearsExperience  = parseFloat(row["Years_of_Experience"] || row["yearsExperience"] || row["experience_years"] || "") || null;
      const currentCTC       = parseFloat(row["Current_CTC"]   || row["currentCTC"]   || row["current_ctc"]  || "") || null;
      const expectedCTC      = parseFloat(row["Expected_CTC"]  || row["expectedCTC"]  || row["expected_ctc"] || "") || null;
      const linkedInUrl      = String(row["LinkedIn_URL"]      || row["linkedInUrl"]  || row["linkedin_url"] || "").trim() || null;
      const openToRelocation = ["yes","true","1"].includes(String(row["Open_to_Relocation"] || row["openToRelocation"] || "").toLowerCase());
      const resumeLink       = String(row["Resume_Link"]       || row["resumeLink"]   || row["Resume"] || row["resume"] || "").trim();

      if (!full_name || !email) { failed++; continue; }

      // Always insert — duplicate emails create new candidates
      const cResult = await db.query(
        `INSERT INTO candidates
           (full_name, email, phone, job_role_id, status,
            current_company, current_ctc, expected_ctc,
            linkedin_url, notice_period, relocation_ready)
         VALUES ($1,$2,$3,$4,'uploaded',$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [full_name, email, phone||null, roleId,
         currentCompany||null, currentCTC, expectedCTC,
         linkedInUrl, noticePeriod||null, openToRelocation]
      );
      const candidateId = cResult.rows[0].id;

      // Download and store resume — recruiter triggers AI later
      if (resumeLink) {
        const fileName = `bulk_${candidateId}.pdf`;
        const destPath = path.join(UPLOAD_DIR, fileName);
        let filePath = null;

        if (resumeLink.startsWith("http://") || resumeLink.startsWith("https://")) {
          const downloadUrl = toDriveDirectUrl(resumeLink);
          try {
            await downloadFile(downloadUrl, destPath);
            filePath = destPath;
          } catch (dlErr) {
            console.error(`Failed to download resume for ${email}:`, dlErr.message);
          }
        } else if (fs.existsSync(resumeLink)) {
          filePath = resumeLink;
        }

        if (filePath) {
          await db.query("DELETE FROM resumes WHERE candidate_id = $1", [candidateId]);
          await db.query(
            `INSERT INTO resumes (candidate_id, file_path, file_name, mime_type)
             VALUES ($1, $2, $3, 'application/pdf')`,
            [candidateId, filePath, fileName]
          );
        }
      }

      processed++;
    } catch (err) {
      console.error("Row error:", err.message);
      failed++;
    }
  }

  await db.query(
    "UPDATE bulk_uploads SET processed=$1, failed=$2, status='completed' WHERE id=$3",
    [processed, failed, bulkId]
  );
}

async function getBulkUpload(req, res) {
  const result = await db.query("SELECT * FROM bulk_uploads WHERE id = $1", [req.params.bulkId]);
  if (!result.rows.length) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
}

module.exports = { bulkUpload, getBulkUpload };
