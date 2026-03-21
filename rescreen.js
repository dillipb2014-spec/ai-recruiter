const axios = require('axios');

const AI_URL      = 'http://localhost:8000';
const INTERNAL_KEY = 'change_me_internal_secret';

const resumes = [
  { resume_id: '57846c94-1db6-4c1f-9b8a-3d40fbddad60', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/f399bd00-e5ee-48f7-8bd1-5017a6bf8cc8.pdf', name: 'Chandan' },
  { resume_id: 'a45f5082-eef9-4e23-8d57-616184b32fc6', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/ff24535e-8854-404d-910c-2b0b42a1c984.pdf', name: 'Dillip' },
  { resume_id: '49d90473-7671-455b-b9c2-8eb462b23698', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/db526c03-e898-48c2-81ff-2f05dcfaa76e.pdf', name: 'Abhijeet' },
  { resume_id: 'eb7de6ce-32ec-4892-8641-c64bec0217d9', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/697e43fd-22fb-49af-a8c9-0ffc3f08022f.pdf', name: 'Abhijeet 2' },
  { resume_id: '12b8cebe-027b-4079-a541-782f617f54b1', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/558e6231-b910-4308-bc81-27ad8be4f76f.pdf', name: 'Anusha' },
  { resume_id: '04bf9ca6-44ce-4d28-8c9d-153178a9e12b', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/bb6afe78-47ae-4c1f-b611-5ac49b52955f.pdf', name: 'Mihir' },
  { resume_id: '26fcf114-3837-4eb5-9469-6befefb510bb', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/369eced0-0d19-4758-a326-9fca266cc0c8.pdf', name: 'Puneeth' },
  { resume_id: 'd7ab7585-07d8-4e72-8878-3e80cc192ab3', file_path: '/Users/dillip.behera/Downloads/ai-recruiter/backend/uploads/755e80a6-1a6f-4e28-b479-d422a3ff9cf9.pdf', name: 'Dillip 2' },
];

async function rescreen() {
  console.log(`🔄 Re-screening ${resumes.length} candidates via Ollama...\n`);

  for (const r of resumes) {
    try {
      process.stdout.write(`  Screening ${r.name}... `);
      const res = await axios.post(`${AI_URL}/screen-resume`, {
        resume_id: r.resume_id,
        file_path: r.file_path,
        job_title: 'UI Developer',
      }, {
        headers: { 'X-Internal-Key': INTERNAL_KEY },
        timeout: 120000, // 2 min — Ollama on CPU is slow
      });
      console.log(`✅ Score: ${res.data.ai_score} → ${res.data.candidate_status}`);
    } catch (e) {
      console.log(`❌ Failed: ${e.response?.data?.detail || e.message}`);
    }
  }

  console.log('\n✅ Re-screening complete. Refresh the dashboard.');
}

rescreen();
