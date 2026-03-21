"use client";
import { useState, useEffect, useRef } from "react";
import {
  fetchJobRoles, createJobRole, bulkCreateJobRoles, updateJobRole, parseJD,
  uploadResumeForRole, getResumeScreeningResult,
} from "@/lib/api";
import ScoreBadge from "./ScoreBadge";

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "Go",
  "Figma", "CSS", "Redux", "GraphQL", "PostgreSQL", "Docker", "AWS", "Rust",
];

export default function JobRolesModal({ onClose }) {
  const [tab, setTab]           = useState("roles");
  const [roles, setRoles]       = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);

  // Form state
  const [editingRole, setEditingRole] = useState(null);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [skills, setSkills]           = useState([]);
  const [skillInput, setSkillInput]   = useState("");
  const [keyPoints, setKeyPoints]     = useState([]);
  const [mandatorySkills, setMandatorySkills] = useState([]);
  const [mandatoryInput, setMandatoryInput]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState("");

  // Bulk create state
  const [bulkTitles, setBulkTitles] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError]   = useState("");
  const [bulkDone, setBulkDone]     = useState(null);

  // JD parse state
  const [jdText, setJdText]       = useState("");
  const [jdFile, setJdFile]       = useState(null);
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState("");
  const jdFileRef = useRef(null);

  // Upload form
  const [candidateName,  setCandidateName]  = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [file, setFile]                     = useState(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadError, setUploadError]       = useState("");
  const [result, setResult]                 = useState(null);
  const [polling, setPolling]               = useState(false);
  const pollRef     = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobRoles().then(setRoles).catch(() => {}).finally(() => setLoadingRoles(false));
  }, []);
  useEffect(() => () => clearInterval(pollRef.current), []);

  function resetForm() {
    setTitle(""); setDescription(""); setRequirements("");
    setSkills([]); setSkillInput(""); setKeyPoints([]);
    setMandatorySkills([]); setMandatoryInput(""); setJdText(""); setJdFile(null);
    setFormError(""); setParseError("");
  }

  function openCreate() {
    setEditingRole(null); resetForm(); setTab("form");
  }

  function openEdit(role) {
    setEditingRole(role);
    setTitle(role.title || "");
    setMandatorySkills(role.mandatory_skills || []);
    setMandatoryInput("");
    let kp = [];
    try { kp = Array.isArray(role.key_points) ? role.key_points : JSON.parse(role.key_points || "[]"); }
    catch {}
    setKeyPoints(kp);
    setJdText(role.original_jd_text || "");
    let sk = [];
    try { sk = role.screening_params?.keywords || []; } catch {}
    setSkills(sk);
    setSkillInput(""); setJdFile(null);
    setFormError(""); setParseError("");
    setTab("form");
  }

  async function handleParseJD() {
    if (!jdText.trim() && !jdFile) return setParseError("Paste JD text or upload a file");
    setParsing(true); setParseError("");
    try {
      const data = await parseJD(jdText, jdFile);
      setKeyPoints(data.key_points || []);
      if (data.suggested_mandatory_skill) setMandatorySkills((prev) => {
        const sk = data.suggested_mandatory_skill;
        return prev.includes(sk) ? prev : [...prev, sk];
      });
    } catch (e) {
      setParseError(e.message);
    } finally {
      setParsing(false);
    }
  }

  function addSkill(sk) {
    const v = (sk || skillInput).trim();
    if (v && !skills.includes(v)) setSkills((s) => [...s, v]);
    setSkillInput("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim()) return setFormError("Title is required");
    setSaving(true); setFormError("");
    try {
      const payload = { title, original_jd_text: jdText, key_points: keyPoints, mandatory_skills: mandatorySkills };
      let saved;
      if (editingRole) {
        saved = await updateJobRole(editingRole.id, payload);
        setRoles((prev) => prev.map((r) => r.id === saved.id ? { ...r, ...saved } : r));
      } else {
        saved = await createJobRole(payload);
        setRoles((prev) => [saved, ...prev]);
      }
      setTab("roles");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkCreate(e) {
    e.preventDefault();
    const titles = bulkTitles.split("\n").map((t) => t.trim()).filter(Boolean);
    if (!titles.length) return setBulkError("Enter at least one role title");
    setBulkSaving(true); setBulkError(""); setBulkDone(null);
    try {
      const res = await bulkCreateJobRoles(titles.map((title) => ({ title })));
      setBulkDone(res.created);
      setBulkTitles("");
      fetchJobRoles().then(setRoles).catch(() => {});
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  function startUpload(role) {
    setSelectedRole(role); setFile(null);
    setCandidateName(""); setCandidateEmail("");
    setUploadError(""); setResult(null); setTab("upload");
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return setUploadError("Please select a resume file");
    setUploading(true); setUploadError(""); setResult(null);
    try {
      const { candidateId } = await uploadResumeForRole(selectedRole.id, file, candidateName, candidateEmail);
      setPolling(true);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await getResumeScreeningResult(candidateId);
          if (r.screening_status === "completed" || r.screening_status === "failed") {
            clearInterval(pollRef.current); setPolling(false); setResult(r);
          }
        } catch {}
        if (attempts >= 20) { clearInterval(pollRef.current); setPolling(false); setUploadError("Screening timed out."); }
      }, 3000);
    } catch (err) { setUploadError(err.message); }
    finally { setUploading(false); }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (!f) return;
    if (!["pdf","doc","docx"].includes(f.name.split(".").pop().toLowerCase())) return setUploadError("Only PDF, DOC, DOCX");
    if (f.size > 5 * 1024 * 1024) return setUploadError("Max 5MB");
    setUploadError(""); setFile(f);
  }

  let resultSkills = [];
  try { resultSkills = Array.isArray(result?.skills) ? result.skills : JSON.parse(result?.skills || "[]"); }
  catch {}

  const isEdit = !!editingRole;

  return (
    <>
      <div onClick={onClose} style={s.overlay} />
      <div style={s.modal}>

        <div style={s.header}>
          <h2 style={s.title}>Job Roles</h2>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.tabs}>
          <button onClick={() => setTab("roles")} style={{ ...s.tab, ...(tab === "roles" ? s.tabActive : {}) }}>All Roles</button>
          <button onClick={openCreate}            style={{ ...s.tab, ...(tab === "form" && !isEdit ? s.tabActive : {}) }}>+ New Role</button>
          <button onClick={() => { setTab("bulk"); setBulkDone(null); setBulkError(""); }} style={{ ...s.tab, ...(tab === "bulk" ? s.tabActive : {}) }}>+ Bulk Create</button>
          {tab === "form" && isEdit  && <button style={{ ...s.tab, ...s.tabActive }}>✏ Edit Role</button>}
          {tab === "upload"          && <button style={{ ...s.tab, ...s.tabActive }}>Upload Resume</button>}
        </div>

        <div style={s.body}>

          {/* ── All Roles ── */}
          {tab === "roles" && (
            loadingRoles ? <p style={s.muted}>Loading…</p> :
            roles.length === 0 ? (
              <div style={s.empty}>
                <p style={s.muted}>No job roles yet.</p>
                <button onClick={openCreate} style={s.btnPrimary}>Create First Role</button>
              </div>
            ) : (
              <div style={s.roleList}>
                {roles.map((r) => {
                  let kp = [];
                  try { kp = Array.isArray(r.key_points) ? r.key_points : JSON.parse(r.key_points || "[]"); } catch {}
                  return (
                    <div key={r.id} style={s.roleCard}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <p style={s.roleTitle}>{r.title}</p>
                          {(r.mandatory_skills?.length > 0) && (
                            <span style={s.mandatoryBadge}>🔒 {r.mandatory_skills.join(", ")}</span>
                          )}
                        </div>
                        {r.description && <p style={s.roleMeta}>{r.description.slice(0, 80)}{r.description.length > 80 ? "…" : ""}</p>}
                        {kp.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                            {kp.map((pt, i) => <span key={i} style={s.kpTag}>{pt}</span>)}
                          </div>
                        )}
                        <p style={s.roleDate}>{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignSelf: "flex-start" }}>
                        <button onClick={() => openEdit(r)} style={s.btnEdit}>✏ Edit</button>
                        <button onClick={() => startUpload(r)} style={s.btnUpload}>Upload Resume</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Bulk Create ── */}
          {tab === "bulk" && (
            <form onSubmit={handleBulkCreate} style={s.form}>
              <p style={s.sectionLabel}>ENTER ONE ROLE TITLE PER LINE</p>
              <textarea
                value={bulkTitles}
                onChange={(e) => setBulkTitles(e.target.value)}
                placeholder={"UI Developer\nBackend Engineer\nData Scientist"}
                rows={8}
                style={{ ...s.input, resize: "vertical", fontSize: 13, fontFamily: "monospace" }}
              />
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                {bulkTitles.split("\n").filter((t) => t.trim()).length} role(s) ready to create
              </p>
              {bulkError && <p style={s.error}>{bulkError}</p>}
              {bulkDone != null && (
                <p style={{ margin: 0, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                  ✅ {bulkDone} role(s) created successfully
                </p>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setTab("roles")} style={s.btnSecondary}>Cancel</button>
                <button type="submit" disabled={bulkSaving} style={s.btnPrimary}>
                  {bulkSaving ? "Creating…" : "Create All Roles"}
                </button>
              </div>
            </form>
          )}

          {/* ── Create / Edit Role ── */}
          {tab === "form" && (
            <form onSubmit={handleSave} style={s.form}>

              {/* Smart JD Intake */}
              <div style={s.jdBox}>
                <p style={s.sectionLabel}>⚡ SMART JD INTAKE — AI EXTRACTION</p>
                <textarea value={jdText} onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the full Job Description here… or upload a PDF below"
                  rows={4} style={{ ...s.input, resize: "vertical", fontSize: 13 }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <label style={s.jdFileLabel}>
                    {jdFile ? `📄 ${jdFile.name}` : "Upload JD (PDF/DOCX)"}
                    <input ref={jdFileRef} type="file" accept=".pdf,.docx,.doc"
                      style={{ display: "none" }}
                      onChange={(e) => setJdFile(e.target.files[0])} />
                  </label>
                  <button type="button" onClick={handleParseJD} disabled={parsing} style={s.btnParse}>
                    {parsing ? "Parsing…" : "✨ Parse with AI"}
                  </button>
                </div>
                {parseError && <p style={s.error}>{parseError}</p>}

                {/* Skeleton while parsing */}
                {parsing && (
                  <div style={s.skeleton}>
                    <div style={s.skeletonBar} />
                    <div style={{ ...s.skeletonBar, width: "70%" }} />
                    <div style={{ ...s.skeletonBar, width: "85%" }} />
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af" }}>AI is reading the JD…</p>
                  </div>
                )}

                {/* Key Points */}
                {!parsing && keyPoints.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <p style={s.sectionLabel}>EXTRACTED KEY POINTS</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {keyPoints.map((pt, i) => <span key={i} style={s.kpTag}>{pt}</span>)}
                    </div>
                  </div>
                )}
              </div>

              <label style={s.label}>Job Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. UI Developer" style={s.input} />

              {/* Mandatory Skills Hard Filter */}
              <div style={s.mandatoryBox}>
                <label style={{ ...s.label, color: "#dc2626" }}>🔒 Mandatory Skills (Hard Filter)</label>
                <p style={s.mandatoryHint}>Candidates missing ANY of these are auto-rejected regardless of score</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {mandatorySkills.map((sk) => (
                    <span key={sk} style={s.mandatoryTag}>
                      {sk}
                      <button type="button" onClick={() => setMandatorySkills((p) => p.filter((x) => x !== sk))} style={s.skillX}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={s.skillInputRow}>
                  <input value={mandatoryInput} onChange={(e) => setMandatoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = mandatoryInput.trim();
                        if (v && !mandatorySkills.includes(v)) setMandatorySkills((p) => [...p, v]);
                        setMandatoryInput("");
                      }
                    }}
                    placeholder="e.g. React, Figma — press Enter to add"
                    style={{ ...s.input, borderColor: "#fca5a5", flex: 1 }} />
                  <button type="button" style={s.btnAdd} onClick={() => {
                    const v = mandatoryInput.trim();
                    if (v && !mandatorySkills.includes(v)) setMandatorySkills((p) => [...p, v]);
                    setMandatoryInput("");
                  }}>Add</button>
                </div>
              </div>

              {/* Screening Keywords */}
              <label style={s.label}>Screening Keywords / Skills</label>
              <div style={s.skillWrap}>
                {skills.map((sk) => (
                  <span key={sk} style={s.skillTag}>
                    {sk}
                    <button type="button" onClick={() => setSkills((s) => s.filter((x) => x !== sk))} style={s.skillX}>✕</button>
                  </span>
                ))}
              </div>
              <div style={s.skillInputRow}>
                <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                  placeholder="Type a skill and press Enter…" style={{ ...s.input, flex: 1 }} />
                <button type="button" onClick={() => addSkill()} style={s.btnAdd}>Add</button>
              </div>
              <div style={s.suggestions}>
                {SKILL_SUGGESTIONS.filter((sk) => !skills.includes(sk)).map((sk) => (
                  <button key={sk} type="button" onClick={() => addSkill(sk)} style={s.suggTag}>{sk}</button>
                ))}
              </div>

              {formError && <p style={s.error}>{formError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setTab("roles")} style={s.btnSecondary}>Cancel</button>
                <button type="submit" disabled={saving} style={s.btnPrimary}>
                  {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </form>
          )}

          {/* ── Upload Resume ── */}
          {tab === "upload" && selectedRole && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={s.uploadRoleLabel}>Role: <strong>{selectedRole.title}</strong></p>
                {selectedRole.mandatory_skills?.length > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                    🔒 Hard filter: must have <strong>{selectedRole.mandatory_skills.join(" + ")}</strong>
                  </p>
                )}
              </div>
              {!result ? (
                <form onSubmit={handleUpload} style={s.form}>
                  <label style={s.label}>Candidate Name</label>
                  <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Full name (optional)" style={s.input} />
                  <label style={s.label}>Candidate Email</label>
                  <input value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="email@example.com (optional)" style={s.input} />
                  <label style={s.label}>Resume File *</label>
                  <div onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}
                    style={{ ...s.dropzone, ...(file ? s.dropzoneActive : {}) }}>
                    {file ? <span style={{ color: "#0052cc", fontWeight: 600 }}>📄 {file.name}</span>
                           : <span style={s.muted}>Drag & drop or click · PDF / DOC / DOCX · max 5MB</span>}
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx"
                      onChange={handleFileDrop} style={{ display: "none" }} />
                  </div>
                  {uploadError && <p style={s.error}>{uploadError}</p>}
                  {polling && <div style={s.pollingBox}>⏳ AI screening in progress…</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button type="button" onClick={() => setTab("roles")} style={s.btnSecondary}>Back</button>
                    <button type="submit" disabled={uploading || polling} style={s.btnPrimary}>
                      {uploading ? "Uploading…" : polling ? "Screening…" : "Upload & Screen"}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={s.resultBox}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#111827" }}>Screening Result</p>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                      background: result.screening_status === "completed" ? "#dcfce7" : "#fee2e2",
                      color: result.screening_status === "completed" ? "#16a34a" : "#dc2626" }}>
                      {result.screening_status}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 14, color: "#374151" }}>AI Score</span>
                    <ScoreBadge score={result.ai_score != null ? parseFloat(result.ai_score) : null} size="lg" />
                  </div>
                  {result.ai_summary && (
                    <div style={s.summaryBox}>
                      <p style={s.sectionLabel}>SUMMARY</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{result.ai_summary}</p>
                    </div>
                  )}
                  {resultSkills.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p style={s.sectionLabel}>SKILLS</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {resultSkills.map((sk) => <span key={sk} style={s.skillTag}>{sk}</span>)}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={() => { setResult(null); setFile(null); }} style={s.btnSecondary}>Upload Another</button>
                    <button onClick={() => setTab("roles")} style={s.btnPrimary}>Back to Roles</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const s = {
  overlay:        { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 },
  modal:          { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, maxWidth: "95vw", maxHeight: "90vh", background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", zIndex: 70, display: "flex", flexDirection: "column", overflow: "hidden" },
  header:         { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" },
  title:          { margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" },
  closeBtn:       { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" },
  tabs:           { display: "flex", gap: 4, padding: "14px 24px 0", borderBottom: "1px solid #f3f4f6" },
  tab:            { padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", background: "none", fontSize: 14, cursor: "pointer", color: "#6b7280", fontWeight: 500 },
  tabActive:      { background: "#eff6ff", color: "#0052cc", fontWeight: 700 },
  body:           { padding: "20px 24px 24px", overflowY: "auto", flex: 1 },
  form:           { display: "flex", flexDirection: "column", gap: 12 },
  label:          { fontSize: 13, fontWeight: 600, color: "#374151" },
  input:          { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" },
  error:          { color: "#dc2626", fontSize: 13, margin: 0 },
  muted:          { color: "#9ca3af", fontSize: 14, margin: 0 },
  empty:          { textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  roleList:       { display: "flex", flexDirection: "column", gap: 10 },
  roleCard:       { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" },
  roleTitle:      { margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" },
  roleMeta:       { margin: "4px 0 0", fontSize: 13, color: "#6b7280" },
  roleDate:       { margin: "6px 0 0", fontSize: 12, color: "#9ca3af" },
  mandatoryBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#fee2e2", color: "#dc2626" },
  mandatoryTag:   { display: "inline-flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999 },
  kpTag:          { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "#f0f9ff", color: "#0369a1", borderWidth: 1, borderStyle: "solid", borderColor: "#bae6fd" },
  btnPrimary:     { padding: "10px 20px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSecondary:   { padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnEdit:        { padding: "7px 14px", background: "#f3f4f6", color: "#374151", borderWidth: 1, borderStyle: "solid", borderColor: "#e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnUpload:      { padding: "7px 14px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnAdd:         { padding: "10px 16px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnParse:       { padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  jdBox:          { background: "#f8f7ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: "14px 16px" },
  jdFileLabel:    { padding: "7px 14px", borderWidth: 1, borderStyle: "dashed", borderColor: "#c4b5fd", borderRadius: 7, fontSize: 12, color: "#7c3aed", cursor: "pointer", background: "#fff" },
  mandatoryBox:   { background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px" },
  mandatoryHint:  { margin: "2px 0 8px", fontSize: 12, color: "#9ca3af" },
  skeleton:       { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  skeletonBar:    { height: 12, background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)", borderRadius: 6, width: "100%", animation: "pulse 1.5s ease-in-out infinite" },
  skillWrap:      { display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 },
  skillTag:       { display: "inline-flex", alignItems: "center", gap: 4, background: "#e6f0ff", color: "#0052cc", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 999 },
  skillX:         { background: "none", border: "none", cursor: "pointer", color: "#0052cc", fontSize: 11, padding: 0, lineHeight: 1 },
  skillInputRow:  { display: "flex", gap: 8 },
  suggestions:    { display: "flex", flexWrap: "wrap", gap: 5 },
  suggTag:        { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, borderWidth: 1, borderStyle: "solid", borderColor: "#e5e7eb", background: "#f9fafb", color: "#374151", cursor: "pointer" },
  dropzone:       { border: "2px dashed #d1d5db", borderRadius: 8, padding: "24px 16px", textAlign: "center", cursor: "pointer", background: "#fafafa" },
  dropzoneActive: { borderColor: "#0052cc", background: "#eff6ff" },
  pollingBox:     { background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" },
  resultBox:      { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20 },
  summaryBox:     { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 },
  sectionLabel:   { margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em" },
  uploadRoleLabel:{ margin: 0, fontSize: 14, color: "#374151" },
};
