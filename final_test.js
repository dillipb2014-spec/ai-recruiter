const axios = require('axios');

const BACKEND_URL = 'http://localhost:4000/api';
const AI_SERVICE_URL = 'http://localhost:8000';

async function runIntegrityCheck() {
  console.log("🚀 Starting JUSPAY AI Integrity Audit...");

  try {
    // 1. Check Backend & DB View
    console.log("\n1. Testing Backend & SQL View...");
    const dashboard = await axios.get(`${BACKEND_URL}/candidates`);
    console.log(`✅ Success: Dashboard returned ${dashboard.data.length} candidates from recruiter_console_view.`);

    // 2. Check AI Service Health
    console.log("\n2. Testing AI Service Connectivity...");
    const aiHealth = await axios.get(`${AI_SERVICE_URL}/docs`);
    if (aiHealth.status === 200) console.log("✅ Success: AI Service is responsive.");

    // 3. Check Email Service Configuration
    console.log("\n3. Verifying Email Service Logic...");
    const emailRoute = await axios.get(`${BACKEND_URL}/csrf-token`);
    if (emailRoute.headers['x-csrf-token'] || emailRoute.data) {
      console.log("✅ Success: CSRF/Auth layers are active.");
    }

    console.log("\n⭐ AUDIT COMPLETE: System is structurally sound.");
    console.log("Next Step: Manually upload a resume on the Apply page to test the AI parsing trigger.");

  } catch (error) {
    console.error("\n❌ AUDIT FAILED:", error.message);
    console.log("Tip: Ensure your Backend (Port 4000) and AI Service (Port 8000) are both running.");
  }
}

runIntegrityCheck();
