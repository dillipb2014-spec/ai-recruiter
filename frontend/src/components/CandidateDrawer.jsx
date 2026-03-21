"use client";
import { useState, useRef } from "react";
import { uploadResume, bulkUpdateStatus } from "@/lib/api";

const STATUS_COLOR = {
  applied:        { bg: "#eff6ff",  color: "#2563eb" },
  uploaded:       { bg: "#f0fdf4",  color: "#15803d" },
  PENDING:        { bg: "#fef3c7",  color: "#d97706" },
  screening:      { bg: "#fef3c7",  color: "#d97706" },
  SCREEN_SELECT:  { bg: "#4f46e5",  color: "#ffffff" },
  SCREEN_REJECT:  { bg: "#fee2e2",  color: "#dc2626" },
  screen_select:  { bg: "#4f46e5",  color: "#ffffff" },
  screen_reject:  { bg: "#fee2e2",  color: "#dc2626" },
  interview:      { bg: "#f3e8ff",  color: "#7c3aed" },
  evaluated:      { bg: "#e0f2fe",  color: "#0369a1" },
  hired:          { bg: "#dcfce7",  color: "#15803d" },
  rejected:       { bg: "#fee2e2",  color: "#dc2626" },
};

const STATUS_LABEL = {
  uploaded:       "Uploaded",
  PENDING:        "Re-Screening…",
  SCREEN_SELECT:  "Pending Recruiter Action",
  SCREEN_REJECT:  "Rejected by AI",
  screen_select:  "Pending Recruiter Action",
  screen_reject:  "Rejected by AI",
  applied:        "Applied",
  screening:      "Screening",
  interview:      "Interview",
  evaluated:      "Evaluated",
  hired:          "Hired",
  rejected:       "Rejected",
};

export default function CandidateDrawer({ candidate, onClose, onRescreen }) {
  if (!candidate) return null;

  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState("");
  const [screening, setScreening]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const fileRef                     = useRef();

  async function handleAction(status) {
    setActionLoading(true);
    try {
      await bulkUpdateStatus([candidate.id], status);
      onRescreen?.();
      onClose();
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  }

  async function handleResumeUpdate(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg(""); setScreening(false);
    try {
      await uploadResume(candidate.id, file);
      setUploadMsg("✅ Resume uploaded — AI screening in progress…");
      setScreening(true);
      onRescreen?.();
      // Poll until screening completes
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/candidates/${candidate.id}`, { credentials: "include" });
          const data = await res.json();
          if (data.screening_status === "completed" || data.screening_status === "failed") {
            clearInterval(poll);
            setScreening(false);
            setUploadMsg(data.screening_status === "completed" ? "✅ Screening complete" : "⚠ Screening failed");
            onRescreen?.();
          }
        } catch { clearInterval(poll); }
      }, 3000);
      setTimeout(() => { clearInterval(poll); setScreening(false); }, 120000);
    } catch (err) {
      setUploadMsg(`⚠ ${err.message}`);
    } finally {
      setUploading(false);
      fileRef.current.value = "";
    }
  }

  const score  = parseFloat(candidate.overall_score ?? candidate.resume_score ?? 0);
  const rec     = candidate.status === "screen_select" ? null
                : score >= 75 ? "hire"
                : score < 50  ? "reject"
                : null;
  const recBg   = rec === "hire" ? "#16a34a" : "#dc2626";
  const status = STATUS_COLOR[candidate.status] || { bg: "#f3f4f6", color: "#374151" };

  let skills = [];
  try { skills = Array.isArray(candidate.skills) ? candidate.skills : JSON.parse(candidate.skills || "[]"); }
  catch { skills = []; }

  let strengths = [];
  try { strengths = Array.isArray(candidate.strengths) ? candidate.strengths : JSON.parse(candidate.strengths || "[]"); }
  catch { strengths = []; }

  let weaknesses = [];
  try { weaknesses = Array.isArray(candidate.weaknesses) ? candidate.weaknesses : JSON.parse(candidate.weaknesses || "[]"); }
  catch { weaknesses = []; }

  const resumeScore    = parseFloat(candidate.resume_score   ?? 0);
  const screeningScore = parseFloat(candidate.overall_score  ?? candidate.screening_score ?? 0);

  return (
    <>
      <div onClick={onClose} style={st.overlay} />
      <div style={st.drawer}>

        {/* Header */}
        <div style={st.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={st.name}>{candidate.full_name}</h2>
            <p style={st.meta}>{candidate.email}</p>
            {candidate.phone && <p style={st.meta}>{candidate.phone}</p>}
            {candidate.job_role_title && (
              <p style={{ ...st.meta, color: "#0052cc", fontWeight: 500 }}>
                {candidate.job_role_title}
              </p>
            )}
          </div>
          <button onClick={onClose} style={st.closeBtn}>✕</button>
        </div>

        {/* Status + Recommendation */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ ...st.pill, background: status.bg, color: status.color, padding: "4px 12px" }}>
            {STATUS_LABEL[candidate.status] ?? candidate.status?.replace(/_/g, " ")}
          </span>
          {rec && (
            <span style={{ ...st.pill, background: recBg, color: "#fff", padding: "4px 12px" }}>
              {rec.toUpperCase()}
            </span>
          )}
          {candidate.experience_years != null && (
            <span style={{ ...st.pill, background: "#f3f4f6", color: "#374151" }}>
              {candidate.experience_years} yrs exp
            </span>
          )}
        </div>

        {/* Score */}
        <div style={st.section}>
          <p style={st.sectionTitle}>SUITABILITY MATCH</p>
          {[
            { label: "Resume",    value: resumeScore },
            { label: "Screening", value: screeningScore },
          ].map(({ label, value }) => {
            const pct   = Math.min(100, Math.max(0, value));
            const color = pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct.toFixed(2)}%</span>
                </div>
                <div style={{ height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── AI Decision Insight card — always first in body ── */}
        {candidate.ai_decision_insight ? (
          <div style={st.insightCard}>
            <p style={st.insightLabel}>✦ AI DECISION INSIGHT</p>
            <p style={st.insightText}>{candidate.ai_decision_insight}</p>
          </div>
        ) : candidate.status === "screening" ? (
          <div style={{ ...st.insightCard, background: "#fefce8", borderColor: "#fde68a" }}>
            <p style={{ ...st.insightLabel, color: "#92400e" }}>✦ AI DECISION INSIGHT</p>
            <p style={{ ...st.insightText, color: "#78350f", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={st.pulse} />AI is analyzing responses…
            </p>
          </div>
        ) : null}

        {/* Skills */}
        {skills.length > 0 && (
          <div style={st.section}>
            <p style={st.sectionTitle}>SKILLS</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skills.map((s) => (
                <span key={s} style={st.skillTag}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div style={st.section}>
            <p style={st.sectionTitle}>STRENGTHS</p>
            {strengths.map((s, i) => (
              <div key={i} style={st.bulletRow}>
                <span style={{ color: "#16a34a", marginRight: 6 }}>✓</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div style={st.section}>
            <p style={st.sectionTitle}>AREAS TO IMPROVE</p>
            {weaknesses.map((w, i) => (
              <div key={i} style={st.bulletRow}>
                <span style={{ color: "#d97706", marginRight: 6 }}>△</span>
                <span style={{ fontSize: 13, color: "#374151" }}>{w}</span>
              </div>
            ))}
          </div>
        )}



        {/* Meta */}
        <div style={st.section}>
          <p style={st.sectionTitle}>DETAILS</p>
          {candidate.current_company && <p style={st.metaRow}>🏢 Company: <strong>{candidate.current_company}</strong></p>}
          {candidate.current_ctc && <p style={st.metaRow}>💰 Current CTC: <strong>₹{candidate.current_ctc} LPA</strong></p>}
          {candidate.expected_ctc && <p style={st.metaRow}>🎯 Expected CTC: <strong>₹{candidate.expected_ctc} LPA</strong></p>}
          {candidate.relocation_ready != null && <p style={st.metaRow}>📍 Relocation: <strong>{candidate.relocation_ready ? "Open" : "Not open"}</strong></p>}
          <p style={st.metaRow}>📅 Applied: {new Date(candidate.created_at).toLocaleDateString()}</p>
          <p style={st.metaRow}>📄 Screening: {candidate.screening_status || "pending"}</p>
          <p style={st.metaRow}>🔗 Source: {candidate.source === "bulk" ? "Bulk Upload" : "Individual"}</p>
          {candidate.linkedin_url && candidate.linkedin_url.includes("linkedin.com") && (
            <p style={st.metaRow}>
              💼 LinkedIn:{" "}
              <a href={candidate.linkedin_url.startsWith("http") ? candidate.linkedin_url : `https://${candidate.linkedin_url}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "#0052cc", fontWeight: 500, textDecoration: "none" }}>
                Click to View Profile
              </a>
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {candidate.resume_serve_name && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/uploads/${candidate.resume_serve_name}`}
                target="_blank"
                rel="noopener noreferrer"
                style={st.viewResumeBtn}
              >
                📄 View Resume
              </a>
            )}
            <label style={{ ...st.viewResumeBtn, background: uploading ? "#f3f4f6" : "#fff7ed", color: "#c2410c", borderColor: "#fed7aa", cursor: uploading ? "not-allowed" : "pointer" }}>
              {uploading ? "Uploading…" : screening ? "⏳ Screening…" : "🔄 Update Resume"}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={handleResumeUpdate}
              />
            </label>
          </div>
          {uploadMsg && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: uploadMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
              {uploadMsg}
            </p>
          )}
        </div>

        {/* Recruiter Action — shown when AI screening is done and awaiting decision */}
        {(candidate.status === "screen_select" || candidate.status === "SCREEN_SELECT") && (
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16, marginTop: 16 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em" }}>RECRUITER ACTION</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={actionLoading}
                onClick={() => handleAction("SCREEN_SELECT")}
                style={{ flex: 1, padding: "10px 0", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ✓ Select
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction("SCREEN_REJECT")}
                style={{ flex: 1, padding: "10px 0", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                ✕ Reject
              </button>
            </div>
            <button
              onClick={() => window.open(`mailto:${candidate.email}?subject=Technical Interview Invitation&body=Hi ${candidate.full_name},%0A%0AWe are pleased to invite you for a technical interview.`, "_blank")}
              style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "#ede9fe", color: "#4f46e5", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              📅 Schedule Technical Interview
            </button>
          </div>
        )}

      </div>
    </>
  );
}

const st = {
  overlay:      { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 },
  drawer:       { position: "fixed", top: 0, right: 0, width: 400, height: "100vh", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 50, overflowY: "auto", padding: 24, boxSizing: "border-box" },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 },
  name:         { margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" },
  meta:         { margin: "3px 0 0", fontSize: 12, color: "#6b7280" },
  closeBtn:     { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280", flexShrink: 0 },
  pill:         { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999 },
  section:      { borderTop: "1px solid #f3f4f6", paddingTop: 14, marginTop: 14 },
  sectionTitle: { margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" },
  scoreRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  skillTag:     { background: "#e6f0ff", color: "#0052cc", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999 },
  bulletRow:    { display: "flex", alignItems: "flex-start", marginBottom: 6 },
  metaRow:      { margin: "0 0 6px", fontSize: 13, color: "#374151" },
  viewResumeBtn: { display: "inline-block", marginTop: 0, padding: "7px 14px", background: "#e6f0ff", color: "#0052cc", borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: "none", borderWidth: 1, borderStyle: "solid", borderColor: "#bfdbfe" },
  insightCard:  { background: "linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)", border: "1px solid #c7d2fe", borderRadius: 10, padding: "12px 16px", marginBottom: 16, backdropFilter: "blur(4px)" },
  insightLabel: { margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em", textTransform: "uppercase" },
  insightText:  { margin: 0, fontSize: 13, color: "#312e81", lineHeight: 1.6 },
  pulse:        { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#d97706", animation: "pulse 1.4s ease-in-out infinite", flexShrink: 0 },
};

// Inject pulse keyframe once
if (typeof document !== "undefined" && !document.getElementById("drawer-pulse-style")) {
  const s = document.createElement("style");
  s.id = "drawer-pulse-style";
  s.textContent = "@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.4)} }";
  document.head.appendChild(s);
}
