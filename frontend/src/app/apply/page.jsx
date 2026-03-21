"use client";
import { useState, useEffect, useRef } from "react";
import { registerCandidate, uploadResume, fetchJobRoles } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = ["Personal", "Professional", "Resume"];

const NOTICE_OPTIONS = ["Immediate", "< 15 days", "30 days", "60 days", "90 days"];
const LOCATION_OPTIONS = ["Remote", "Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Other"];
const INITIAL_FORM = {
  full_name: "", email: "", phone: "", location: "", notice_period: "",
  current_company: "", job_role_id: "", experience_years: "",
  current_ctc: "", expected_ctc: "", relocation_ready: false,
  linkedin_url: "",
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={sk.wrap}>
      <div style={sk.spinner} />
      <p style={sk.label}>AI Parsing Resume…</p>
      <div style={sk.bar}><div style={sk.fill} /></div>
      <p style={sk.hint}>Extracting skills, experience & scoring against JD</p>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Stepper({ current }) {
  return (
    <div style={sp.wrap}>
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} style={sp.item}>
            <div style={{ ...sp.dot, ...(done ? sp.dotDone : active ? sp.dotActive : sp.dotIdle) }}>
              {done ? "✓" : i + 1}
            </div>
            <span style={{ ...sp.label, color: active ? "#fff" : done ? "#a5b4fc" : "rgba(255,255,255,0.4)" }}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div style={{ ...sp.line, background: done ? "#a5b4fc" : "rgba(255,255,255,0.15)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={f.label}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={f.err}>{error}</span>}
    </div>
  );
}

function Input({ error, mono, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...f.input,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
        borderColor: error ? "#f87171" : focused ? "#818cf8" : "rgba(255,255,255,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(129,140,248,0.25)" : "none",
      }}
    />
  );
}

function Select({ error, children, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...f.input,
        cursor: "pointer",
        borderColor: error ? "#f87171" : focused ? "#818cf8" : "rgba(255,255,255,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(129,140,248,0.25)" : "none",
      }}
    >
      {children}
    </select>
  );
}

// ── Drag-drop resume zone ─────────────────────────────────────────────────────
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

  if (parsing) return <Skeleton />;

  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        ...dz.zone,
        borderColor: drag ? "#818cf8" : file ? "#34d399" : "rgba(255,255,255,0.2)",
        background:  drag ? "rgba(129,140,248,0.08)" : file ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
      }}
    >
      <input ref={ref} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
        onChange={(e) => handle(e.target.files[0])} />
      {file ? (
        <>
          <div style={dz.icon}>📄</div>
          <p style={{ ...dz.main, color: "#34d399" }}>{file.name}</p>
          <p style={dz.sub}>{(file.size / 1024).toFixed(0)} KB · Click to replace</p>
        </>
      ) : (
        <>
          <div style={dz.icon}>⬆</div>
          <p style={dz.main}>Drop your resume here</p>
          <p style={dz.sub}>or click to browse · PDF, DOC, DOCX · max 5MB</p>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const [form, setForm]       = useState(INITIAL_FORM);
  const [file, setFile]       = useState(null);
  const [errors, setErrors]   = useState({});
  const [step, setStep]       = useState(0);           // 0 | 1 | 2
  const [status, setStatus]   = useState("idle");      // idle | parsing | submitting | error
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errMsg, setErrMsg]   = useState("");
  const [roles, setRoles]     = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    fetchJobRoles().then(setRoles).catch(() => {}).finally(() => setRolesLoading(false));
  }, []);

  const set = (field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  function validateStep(s) {
    const e = {};
    if (s === 0) {
      if (!form.full_name.trim())  e.full_name = "Required";
      if (!form.email.trim())      e.email     = "Required";
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
      if (!form.notice_period)     e.notice_period = "Required";
    }
    if (s === 1) {
      if (!form.job_role_id)       e.job_role_id = "Select a position";
      if (!form.current_company.trim()) e.current_company = "Required";
      if (!form.current_ctc)       e.current_ctc = "Required";
      if (!form.expected_ctc)      e.expected_ctc = "Required";
      if (form.linkedin_url && !/^https:\/\/www\.linkedin\.com\/in\//.test(form.linkedin_url))
        e.linkedin_url = "Must start with https://www.linkedin.com/in/";
    }
    if (s === 2) {
      if (!file) e.file = "Please upload your resume";
    }
    return e;
  }

  function next() {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep((s) => s + 1);
  }

  function back() { setErrors({}); setStep((s) => s - 1); }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validateStep(2);
    if (Object.keys(e2).length) { setErrors(e2); return; }

    setStatus("parsing");
    setErrors({});
    try {
      const payload = {
        full_name:        form.full_name,
        email:            form.email,
        phone:            form.phone || undefined,
        job_role_id:      form.job_role_id,
        linkedin_url:     form.linkedin_url || undefined,
        current_company:  form.current_company || undefined,
        current_ctc:      form.current_ctc ? parseFloat(form.current_ctc) : undefined,
        expected_ctc:     form.expected_ctc ? parseFloat(form.expected_ctc) : undefined,
        notice_period:    form.notice_period || undefined,
        relocation_ready: form.relocation_ready,
        current_location: form.location || undefined,
        experience_years: form.experience_years ? parseFloat(form.experience_years) : undefined,
      };
      const { candidate } = await registerCandidate(payload);
      await uploadResume(candidate.id, file);
      setIsSubmitted(true);
    } catch (err) {
      setErrMsg(err.message);
      setStatus("error");
    }
  }

  const progress = ((step + (isSubmitted ? 1 : 0)) / STEPS.length) * 100;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <main style={pg.bg}>
        <div style={pg.grid} />
        <style>{`
          @keyframes successPop {
            from { opacity: 0; transform: scale(0.9) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
        <div style={{ ...pg.glass, textAlign: "center", maxWidth: 480, animation: "successPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
          <h2 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
            Thank You!
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 28px", fontSize: 14, lineHeight: 1.7 }}>
            Thank you for applying to <strong style={{ color: "#a5b4fc" }}>Juspay</strong>. We have received your application and our team will review it shortly. You will hear from us on the next steps.
          </p>
          <a href="https://juspay.in" target="_blank" rel="noopener noreferrer" style={{ ...pg.btnPrimary, display: "inline-block", textDecoration: "none" }}>
            Go to Juspay Home
          </a>
        </div>
      </main>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <main style={pg.bg}>
      <div style={pg.grid} />

      <div style={pg.wrap}>
        {/* Brand */}
        <div style={pg.brand}>
          <span style={pg.brandName}>JUSPAY</span>
          <span style={pg.brandAi}>AI</span>
        </div>

        {/* Progress bar */}
        <div style={pg.progressTrack}>
          <div style={{ ...pg.progressFill, width: `${progress}%` }} />
        </div>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Glass card */}
        <div style={pg.glass}>
          <form onSubmit={handleSubmit}>

            {/* ── Step 0: Personal ── */}
            {step === 0 && (
              <div style={pg.fields}>
                <h2 style={pg.stepTitle}>Personal Details</h2>
                <p style={pg.stepSub}>Tell us who you are</p>

                <div style={pg.grid2}>
                  <Field label="Full Name" required error={errors.full_name}>
                    <Input placeholder="Arjun Sharma" value={form.full_name} onChange={set("full_name")} error={errors.full_name} />
                  </Field>
                  <Field label="Email" required error={errors.email}>
                    <Input type="email" placeholder="arjun@example.com" value={form.email} onChange={set("email")} error={errors.email} mono />
                  </Field>
                </div>

                <div style={pg.grid2}>
                  <Field label="Phone">
                    <Input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
                  </Field>
                  <Field label="Current Location">
                    <Select value={form.location} onChange={set("location")}>
                      <option value="">— Select city —</option>
                      {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </Field>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={f.label}>Notice Period<span style={{ color: "#f87171", marginLeft: 2 }}>*</span></span>
                  <div style={pg.tagRow}>
                    {NOTICE_OPTIONS.map((n) => (
                      <button key={n} type="button"
                        onClick={() => { setForm((f) => ({ ...f, notice_period: n })); setErrors((e) => ({ ...e, notice_period: undefined })); }}
                        style={{ ...pg.tag, ...(form.notice_period === n ? pg.tagActive : {}) }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {errors.notice_period && <span style={f.err}>{errors.notice_period}</span>}
                </div>
              </div>
            )}

            {/* ── Step 1: Professional ── */}
            {step === 1 && (
              <div style={pg.fields}>
                <h2 style={pg.stepTitle}>Professional Profile</h2>
                <p style={pg.stepSub}>Help us match you to the right role</p>

                <Field label="Position" required error={errors.job_role_id}>
                  {rolesLoading ? (
                    <div style={f.loading}>Loading open positions…</div>
                  ) : (
                    <Select value={form.job_role_id} onChange={set("job_role_id")} error={errors.job_role_id}>
                      <option value="">— Select a position —</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </Select>
                  )}
                </Field>

                <Field label="Current Company" required error={errors.current_company}>
                  <Input placeholder="e.g. Razorpay" value={form.current_company} onChange={set("current_company")} error={errors.current_company} />
                </Field>

                <div style={pg.grid2}>
                  <Field label="Years of Experience">
                    <Input type="number" min="0" max="40" placeholder="e.g. 4" value={form.experience_years} onChange={set("experience_years")} />
                  </Field>
                  <Field label="Current CTC (LPA)" required error={errors.current_ctc}>
                    <Input type="number" min="0" placeholder="e.g. 12" value={form.current_ctc} onChange={set("current_ctc")} error={errors.current_ctc} />
                  </Field>
                </div>

                <div style={pg.grid2}>
                  <Field label="Expected CTC (LPA)" required error={errors.expected_ctc}>
                    <Input type="number" min="0" placeholder="e.g. 18" value={form.expected_ctc} onChange={set("expected_ctc")} error={errors.expected_ctc} />
                  </Field>
                  <Field label="LinkedIn Profile URL" error={errors.linkedin_url}>
                    <Input placeholder="https://www.linkedin.com/in/username" value={form.linkedin_url} onChange={set("linkedin_url")} error={errors.linkedin_url} mono />
                  </Field>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={f.label}>Open to Relocation?</span>
                  <div style={pg.tagRow}>
                    {["Yes", "No"].map((opt) => (
                      <button key={opt} type="button"
                        onClick={() => setForm((f) => ({ ...f, relocation_ready: opt === "Yes" }))}
                        style={{ ...pg.tag, ...(form.relocation_ready === (opt === "Yes") ? pg.tagActive : {}) }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Resume ── */}
            {step === 2 && (
              <div style={pg.fields}>
                <h2 style={pg.stepTitle}>Upload Resume</h2>
                <p style={pg.stepSub}>Our AI will parse and score it against the JD instantly</p>

                <DropZone file={file} onChange={setFile} parsing={status === "parsing"} />
                {errors.file && <span style={{ ...f.err, marginTop: 4 }}>{errors.file}</span>}

                {status === "error" && (
                  <div style={pg.errBox}>✗ {errMsg}</div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div style={pg.navRow}>
              {step > 0 && (
                <button type="button" onClick={back} style={pg.btnBack}>← Back</button>
              )}
              <div style={{ flex: 1 }} />
              {step < 2 ? (
                <button type="button" onClick={next} style={pg.btnPrimary}>
                  Continue →
                </button>
              ) : (
                <button type="submit"
                  disabled={status === "parsing" || status === "submitting"}
                  style={{ ...pg.btnPrimary, opacity: status === "parsing" ? 0.6 : 1 }}>
                  {status === "parsing" ? "Submitting…" : "Submit Application"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pg = {
  bg:           { minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", position: "relative", overflow: "hidden" },
  grid:         { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" },
  wrap:         { width: "100%", maxWidth: 600, position: "relative", zIndex: 1 },
  brand:        { textAlign: "center", marginBottom: 20 },
  brandName:    { fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" },
  brandAi:      { fontSize: 26, fontWeight: 700, color: "#818cf8", marginLeft: 4 },
  progressTrack:{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 999, marginBottom: 20, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: 999, transition: "width 0.4s ease" },
  glass:        { background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "32px 36px", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" },
  fields:       { display: "flex", flexDirection: "column", gap: 20 },
  stepTitle:    { margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#fff" },
  stepSub:      { margin: "0 0 4px", fontSize: 13, color: "rgba(255,255,255,0.45)" },
  grid2:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  tagRow:       { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag:          { padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", cursor: "pointer" },
  tagActive:    { background: "rgba(129,140,248,0.2)", borderWidth: 1, borderStyle: "solid", borderColor: "#818cf8", color: "#c7d2fe" },
  jdBox:        { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "12px 14px" },
  jdLabel:      { margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "#818cf8", letterSpacing: "0.1em" },
  jdText:       { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 },
  navRow:       { display: "flex", alignItems: "center", marginTop: 28, gap: 10 },
  btnPrimary:   { padding: "11px 28px", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" },
  btnBack:      { padding: "11px 20px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 14, cursor: "pointer" },
  errBox:       { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#fca5a5" },
};

const f = {
  label:   { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" },
  input:   { padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 13, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s" },
  err:     { fontSize: 11, color: "#f87171" },
  loading: { padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.3)" },
};

const dz = {
  zone:  { border: "2px dashed", borderRadius: 12, padding: "40px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" },
  icon:  { fontSize: 32, marginBottom: 12 },
  main:  { margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)" },
  sub:   { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.35)" },
};

const sk = {
  wrap:    { padding: "32px 24px", textAlign: "center", border: "2px dashed rgba(129,140,248,0.3)", borderRadius: 12, background: "rgba(99,102,241,0.05)" },
  spinner: { width: 36, height: 36, border: "3px solid rgba(129,140,248,0.2)", borderTop: "3px solid #818cf8", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" },
  label:   { margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#a5b4fc" },
  bar:     { height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", margin: "0 auto 10px", maxWidth: 200 },
  fill:    { height: "100%", width: "60%", background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: 999, animation: "pulse 1.5s ease-in-out infinite" },
  hint:    { margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" },
};

const sp = {
  wrap:       { display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, gap: 0 },
  item:       { display: "flex", alignItems: "center", gap: 8 },
  dot:        { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  dotIdle:    { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" },
  dotActive:  { background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", boxShadow: "0 0 12px rgba(99,102,241,0.5)" },
  dotDone:    { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" },
  label:      { fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" },
  line:       { width: 40, height: 1, flexShrink: 0 },
};
