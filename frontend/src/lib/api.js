const ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_ALLOWED_API_HOSTS || "localhost:4000").split(",");

const BASE_URL = (() => {
  const url  = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const host = new URL(url).host;
  if (!ALLOWED_HOSTS.includes(host)) throw new Error(`Untrusted API host: ${host}`);
  return url;
})();

export function apiUrl(urlPath) {
  const url = new URL(urlPath, BASE_URL);
  if (url.host !== new URL(BASE_URL).host) throw new Error("SSRF blocked: host mismatch");
  return url.toString();
}

let _csrfToken = "";
export async function getCsrfToken() {
  if (_csrfToken) return _csrfToken;
  const res = await fetch(apiUrl("/api/csrf-token"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch CSRF token");
  _csrfToken = (await res.json()).csrfToken;
  return _csrfToken;
}

export async function fetchCandidates(params = {}) {
  const q = new URLSearchParams();
  const allowed = [
    "status", "search", "sort", "order",
    "score_min", "score_max",
    "skills", "proficiency", "exp_bucket",
    "comm_min", "confidence",
    "source", "timeline", "notice_period",
  ];
  allowed.forEach((k) => { if (params[k] != null && params[k] !== "") q.set(k, params[k]); });
  const res = await fetch(apiUrl(`/api/candidates?${q}`), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export async function fetchCandidateDetail(candidateId) {
  const res = await fetch(
    apiUrl(`/api/candidates/${encodeURIComponent(candidateId)}/scorecard`),
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to fetch candidate detail");
  return res.json();
}

export async function registerCandidate(data) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl("/api/candidates"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Registration failed");
  return res.json();
}

export async function uploadResume(candidateId, file) {
  const csrfToken = await getCsrfToken();
  const form = new FormData();
  form.append("resume", file);
  const res = await fetch(apiUrl(`/api/resumes/${encodeURIComponent(candidateId)}`), {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
  return res.json();
}

export async function fetchJobRoles() {
  const res = await fetch(apiUrl("/api/job-roles"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch job roles");
  return res.json();
}

export async function createJobRole(data) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl("/api/job-roles"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to create job role");
  return res.json();
}

export async function bulkCreateJobRoles(roles) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl("/api/job-roles/bulk"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify({ roles }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Bulk create failed");
  return res.json();
}

export async function parseJD(text, file) {
  const form = new FormData();
  if (file) form.append("file", file);
  else form.append("jd_text", text || "");
  const res = await fetch(apiUrl("/api/parse-jd"), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail || e.error || "JD parse failed"); }
  return res.json();
}

export async function updateJobRole(id, data) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl(`/api/job-roles/${encodeURIComponent(id)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to update job role");
  return res.json();
}

export async function uploadResumeForRole(roleId, file, candidateName, candidateEmail) {
  const csrfToken = await getCsrfToken();
  const form = new FormData();
  form.append("resume", file);
  if (candidateName)  form.append("full_name", candidateName);
  if (candidateEmail) form.append("email", candidateEmail);
  const res = await fetch(apiUrl(`/api/job-roles/${encodeURIComponent(roleId)}/upload`), {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
  return res.json();
}

export async function getResumeScreeningResult(candidateId) {
  const res = await fetch(apiUrl(`/api/resumes/${encodeURIComponent(candidateId)}`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch screening result");
  return res.json();
}

export async function bulkUploadCandidates(roleId, file) {
  const csrfToken = await getCsrfToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(apiUrl(`/api/bulk-upload/${encodeURIComponent(roleId)}`), {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).error || "Bulk upload failed");
  return res.json();
}

export async function bulkUpdateStatus(ids, status) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl("/api/candidates/bulk-status"), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Bulk update failed");
  return res.json();
}

export async function sendRejectionEmails(ids) {
  const csrfToken = await getCsrfToken();
  const res = await fetch(apiUrl("/api/candidates/send-rejections"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to send emails");
  return res.json();
}

export async function getBulkUploadStatus(bulkId) {
  const res = await fetch(apiUrl(`/api/bulk-upload/${encodeURIComponent(bulkId)}/status`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch bulk upload status");
  return res.json();
}

export async function sendScreeningTest(candidateId) {
  const res = await fetch(apiUrl(`/api/admin/send-screening/${encodeURIComponent(candidateId)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to trigger screening");
  return res.json();
}

export async function triggerBulkScan() {
  const res = await fetch(apiUrl("/api/admin/bulk-scan"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.json()).error || "Bulk scan failed");
  return res.json();
}

export async function getBulkScanStatus() {
  const res = await fetch(apiUrl("/api/admin/bulk-scan/status"), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch scan status");
  return res.json();
}

export async function uploadVideo(interviewId, questionIndex, blob, onProgress) {
  const csrfToken = await getCsrfToken();
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("video", blob, `response_${questionIndex}.webm`);
    form.append("question_index", questionIndex);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(`/api/interviews/${encodeURIComponent(interviewId)}/responses`));
    xhr.setRequestHeader("x-csrf-token", csrfToken);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload  = () => xhr.status === 201 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed"));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
