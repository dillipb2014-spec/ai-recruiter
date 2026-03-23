"use client";
import { useState, useEffect, useRef } from "react";
import { registerCandidate, uploadResume, fetchJobRoles } from "@/lib/api";

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const STEPS = ["Personal", "Professional", "Resume"];
const NOTICE_OPTIONS = ["Immediate", "< 15 days", "30 days", "60 days", "90 days"];
const LOCATION_OPTIONS = ["Remote", "Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Other"];
const INITIAL_FORM = {
  full_name: "", email: "", phone: "", location: "", notice_period: "",
  current_company: "", job_role_id: "", experience_years: "",
  current_ctc: "", expected_ctc: "", relocation_ready: false, linkedin_url: "",
};

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, gap: 0 }}>
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
                background: done ? "#dcfce7" : active ? "#0052cc" : "#f3f4f6",
                color:      done ? "#16a34a" : active ? "#fff"    : "#9ca3af",
                border:     done ? "1.5px solid #16a34a" : active ? "none" : "1.5px solid #e5e7eb",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: active ? "#0052cc" : done ? "#16a34a" : "#9ca3af", whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 64, height: 1.5, background: done ? "#16a34a" : "#e5e7eb", margin: "0 8px", marginBottom: 20, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, required, error, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", letterSpacing: "0.01em", fontFamily: FONT }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint  && !error && <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: FONT }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: "#dc2626", fontFamily: FONT }}>{error}</span>}
    </div>
  );
}

function Input({ error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: "9px 12px", border: `1px solid ${error ? "#dc2626" : focused ? "#0052cc" : "#e5e7eb"}`,
        borderRadius: 7, fontSize: 13, color: "#111827", outline: "none", width: "100%",
        boxSizing: "border-box", background: "#fff", fontFamily: FONT,
        boxShadow: focused ? "0 0 0 3px rgba(0,82,204,0.1)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    />
  );
}

function Select({ error, children, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <select {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        padding: "9px 12px", border: `1px solid ${error ? "#dc2626" : focused ? "#0052cc" : "#e5e7eb"}`,
        borderRadius: 7, fontSize: 13, color: "#111827", outline: "none", width: "100%",
        boxSizing: "border-box", background: "#fff", cursor: "pointer", fontFamily: FONT,
        boxShadow: focused ? "0 0 0 3px rgba(0,82,204,0.1)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >{children}</select>
  );
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ file, onChange, parsing }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);

  function handle(f) {
    if (!f) return;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (![".pdf", ".doc", ".docx"].includes(ext)) { alert("PDF, DOC or DOCX only"); return; }
    if (f.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    onChange(f);
  }

  if (parsing) {
    return (
      <div style={{ border: "1.5px dashed #e5e7eb", borderRadius: 10, padding: "40px 24px", textAlign: "center", background: "#f9fafb" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTop: "3px solid #0052cc", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#0052cc", fontFamily: FONT }}>AI Parsing Resume…</p>
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontFamily: FONT }}>Extracting skills, experience & scoring against JD</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `1.5px dashed ${drag ? "#0052cc" : file ? "#16a34a" : "#e5e7eb"}`,
        borderRadius: 10, padding: "40px 24px", textAlign: "center", cursor: "pointer",
        background: drag ? "#e6f0ff" : file ? "#f0fdf4" : "#f9fafb",
        transition: "all 0.2s",
      }}
    >
      <input ref={ref} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
        onChange={(e) => handle(e.target.files[0])} />
      <div style={{ fontSize: 32, marginBottom: 10 }}>{file ? "📄" : "⬆️"}</div>
      {file ? (
        <>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#16a34a", fontFamily: FONT }}>{file.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontFamily: FONT }}>{(file.size / 1024).toFixed(0)} KB · Click to replace</p>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: FONT }}>Drop your resume here</p>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontFamily: FONT }}>or click to browse · PDF, DOC, DOCX · max 5MB</p>
        </>
      )}
    </div>
  );
}

// ── Tag Button ────────────────────────────────────────────────────────────────
function TagBtn({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer",
      border: `1px solid ${active ? "#0052cc" : "#e5e7eb"}`,
      background: active ? "#e6f0ff" : "#fff",
      color: active ? "#0052cc" : "#6b7280",
      fontFamily: FONT, transition: "all 0.15s",
    }}>{label}</button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const [form, setForm]     = useState(INITIAL_FORM);
  const [file, setFile]     = useState(null);
  const [errors, setErrors] = useState({});
  const [step, setStep]     = useState(0);
  const [status, setStatus] = useState("idle");
  const [submitted, setSubmitted] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [roles, setRoles]   = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    fetchJobRoles().then(setRoles).catch(() => {}).finally(() => setRolesLoading(false));
  }, []);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm(f => ({ ...f, [field]: val }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  function validate(s) {
    const e = {};
    if (s === 0) {
      if (!form.full_name.trim()) e.full_name = "Required";
      if (!form.email.trim())     e.email = "Required";
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
      if (!form.notice_period)    e.notice_period = "Required";
    }
    if (s === 1) {
      if (!form.job_role_id)           e.job_role_id = "Select a position";
      if (!form.current_company.trim()) e.current_company = "Required";
      if (!form.current_ctc)           e.current_ctc = "Required";
      if (!form.expected_ctc)          e.expected_ctc = "Required";
      if (form.linkedin_url && !/^https:\/\/www\.linkedin\.com\/in\//.test(form.linkedin_url))
        e.linkedin_url = "Must start with https://www.linkedin.com/in/";
    }
    if (s === 2) { if (!file) e.file = "Please upload your resume"; }
    return e;
  }

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setStep(s => s + 1);
  }
  function back() { setErrors({}); setStep(s => s - 1); }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate(2);
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setStatus("parsing"); setErrors({});
    try {
      const payload = {
        full_name: form.full_name, email: form.email,
        phone: form.phone || undefined, job_role_id: form.job_role_id,
        linkedin_url: form.linkedin_url || undefined,
        current_company: form.current_company || undefined,
        current_ctc:  form.current_ctc  ? parseFloat(form.current_ctc)  : undefined,
        expected_ctc: form.expected_ctc ? parseFloat(form.expected_ctc) : undefined,
        notice_period: form.notice_period || undefined,
        relocation_ready: form.relocation_ready,
        current_location: form.location || undefined,
        experience_years: form.experience_years ? parseFloat(form.experience_years) : undefined,
      };
      const { candidate } = await registerCandidate(payload);
      await uploadResume(candidate.id, file);
      setSubmitted(true);
    } catch (err) {
      setErrMsg(err.message); setStatus("error");
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <main style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: FONT }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "48px 40px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, background: "#dcfce7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>✓</div>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700, color: "#111827" }}>Application Submitted!</h2>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
            Thank you for applying to <strong style={{ color: "#0052cc" }}>Juspay</strong>. Your application has been received successfully.
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 14px", marginBottom: 28 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📧</span>
            <p style={{ margin: 0, fontSize: 13, color: "#1e40af", lineHeight: 1.6 }}>
              <strong>Check your email</strong> — we've sent you a link to complete a short screening test. Please complete it to move forward in the process.
            </p>
          </div>
          <a href="https://juspay.in" target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-block", padding: "10px 28px", background: "#0052cc", color: "#fff", borderRadius: 7, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            Visit Juspay.in →
          </a>
        </div>
      </main>
    );
  }

  const progress = (step / STEPS.length) * 100;

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 580 }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <img src="/juspay-logo.svg" alt="Juspay" style={{ height: 30 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "#0052cc" }}>AI</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: "#e6f0ff", color: "#0052cc", padding: "2px 8px", borderRadius: 999 }}>HIRING</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Join the team building India's payment infrastructure</p>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "#e5e7eb", borderRadius: 999, marginBottom: 28, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#0052cc", borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 36px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <form onSubmit={handleSubmit}>

            {/* ── Step 0: Personal ── */}
            {step === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ marginBottom: 4 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Personal Details</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Tell us who you are</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Full Name" required error={errors.full_name}>
                    <Input placeholder="Arjun Sharma" value={form.full_name} onChange={set("full_name")} error={errors.full_name} />
                  </Field>
                  <Field label="Email" required error={errors.email}>
                    <Input type="email" placeholder="arjun@example.com" value={form.email} onChange={set("email")} error={errors.email} />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Phone">
                    <Input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
                  </Field>
                  <Field label="Current Location">
                    <Select value={form.location} onChange={set("location")}>
                      <option value="">— Select city —</option>
                      {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </Field>
                </div>

                <Field label="Notice Period" required error={errors.notice_period}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {NOTICE_OPTIONS.map(n => (
                      <TagBtn key={n} label={n} active={form.notice_period === n}
                        onClick={() => { setForm(f => ({ ...f, notice_period: n })); setErrors(e => ({ ...e, notice_period: undefined })); }} />
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── Step 1: Professional ── */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ marginBottom: 4 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Professional Profile</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Help us match you to the right role</p>
                </div>

                <Field label="Position" required error={errors.job_role_id}>
                  {rolesLoading
                    ? <div style={{ padding: "9px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#9ca3af" }}>Loading positions…</div>
                    : <Select value={form.job_role_id} onChange={set("job_role_id")} error={errors.job_role_id}>
                        <option value="">— Select a position —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </Select>
                  }
                </Field>

                <Field label="Current Company" required error={errors.current_company}>
                  <Input placeholder="e.g. Razorpay" value={form.current_company} onChange={set("current_company")} error={errors.current_company} />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Years of Experience">
                    <Input type="number" min="0" max="40" placeholder="e.g. 4" value={form.experience_years} onChange={set("experience_years")} />
                  </Field>
                  <Field label="Current CTC (LPA)" required error={errors.current_ctc}>
                    <Input type="number" min="0" placeholder="e.g. 12" value={form.current_ctc} onChange={set("current_ctc")} error={errors.current_ctc} />
                  </Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label="Expected CTC (LPA)" required error={errors.expected_ctc}>
                    <Input type="number" min="0" placeholder="e.g. 18" value={form.expected_ctc} onChange={set("expected_ctc")} error={errors.expected_ctc} />
                  </Field>
                  <Field label="LinkedIn URL" error={errors.linkedin_url} hint="linkedin.com/in/username">
                    <Input placeholder="https://www.linkedin.com/in/…" value={form.linkedin_url} onChange={set("linkedin_url")} error={errors.linkedin_url} />
                  </Field>
                </div>

                <Field label="Open to Relocation?">
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    {["Yes", "No"].map(opt => (
                      <TagBtn key={opt} label={opt} active={form.relocation_ready === (opt === "Yes")}
                        onClick={() => setForm(f => ({ ...f, relocation_ready: opt === "Yes" }))} />
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── Step 2: Resume ── */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ marginBottom: 4 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Upload Resume</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Our AI will parse and score it against the JD instantly</p>
                </div>

                <DropZone file={file} onChange={setFile} parsing={status === "parsing"} />
                {errors.file && <span style={{ fontSize: 11, color: "#dc2626" }}>{errors.file}</span>}

                {status === "error" && (
                  <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                    ✗ {errMsg}
                  </div>
                )}

                {/* Summary */}
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Application Summary</p>
                  {[
                    { label: "Name",     value: form.full_name },
                    { label: "Email",    value: form.email },
                    { label: "Role",     value: roles.find(r => r.id === form.job_role_id)?.title || "—" },
                    { label: "Company",  value: form.current_company || "—" },
                    { label: "Notice",   value: form.notice_period || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nav */}
            <div style={{ display: "flex", alignItems: "center", marginTop: 28, gap: 10 }}>
              {step > 0 && (
                <button type="button" onClick={back}
                  style={{ padding: "9px 20px", background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              {step < 2 ? (
                <button type="button" onClick={next}
                  style={{ padding: "9px 24px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  Continue →
                </button>
              ) : (
                <button type="submit" disabled={status === "parsing"}
                  style={{ padding: "9px 24px", background: status === "parsing" ? "#9ca3af" : "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: status === "parsing" ? "not-allowed" : "pointer", fontFamily: FONT }}>
                  {status === "parsing" ? "Submitting…" : "Submit Application"}
                </button>
              )}
            </div>

          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#d1d5db" }}>
          © {new Date().getFullYear()} Juspay Technologies · Your data is secure
        </p>
      </div>
    </main>
  );
}
