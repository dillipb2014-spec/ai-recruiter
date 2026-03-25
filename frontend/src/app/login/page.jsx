"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const FEATURES = [
  { icon: "⚡", title: "AI-Powered Screening", desc: "Resumes scored instantly with LLM-based analysis" },
  { icon: "🎯", title: "Smart Matching", desc: "Genius Match surfaces top candidates automatically" },
  { icon: "📊", title: "Analytics Dashboard", desc: "Pipeline funnel, score distribution, role-wise insights" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.shell}>

      {/* ── Left Panel ── */}
      <div style={s.left}>
        <div style={s.leftInner}>

          {/* Logo */}
          <div style={s.logoRow}>
            <img src="/juspay-logo.svg" alt="Juspay" style={{ height: 32 }} />
          </div>

          {/* Hero text */}
          <div style={s.hero}>
            <div style={s.aiChip}>✦ AI Recruiter</div>
            <p style={s.heroSub}>
              Intelligent candidate screening and evaluation
            </p>
          </div>

          {/* Feature list */}
          <div style={s.features}>
            {FEATURES.map((f) => (
              <div key={f.title} style={s.featureRow}>
                <div style={s.featureIcon}>{f.icon}</div>
                <div>
                  <p style={s.featureTitle}>{f.title}</p>
                  <p style={s.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom badge */}
          <div style={s.badge}>
            <span style={s.badgeDot} />
            Powered by Juspay Engineering
          </div>
        </div>

        {/* Decorative circles */}
        <div style={{ ...s.circle, width: 320, height: 320, bottom: -80, right: -80, opacity: 0.07 }} />
        <div style={{ ...s.circle, width: 180, height: 180, top: 60, right: 40, opacity: 0.05 }} />
      </div>

      {/* ── Right Panel ── */}
      <div style={s.right}>
        <div style={s.formCard}>

          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Welcome back</h2>
            <p style={s.formSub}>Sign in to your recruiter account</p>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>

            <div style={s.field}>
              <label style={s.label}>Work Email</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={s.input} placeholder="recruiter@juspay.in"
                  autoComplete="email"
                />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPw ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={s.input} placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={s.eyeBtn}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div style={s.errorBox}>
                <span style={{ marginRight: 6 }}>⚠</span>{error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.75 : 1 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={s.spinner} /> Signing in…
                </span>
              ) : "Sign In →"}
            </button>
          </form>

          <p style={s.applyLink}>
            Not a recruiter?{" "}
            <a href="/apply" style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>
              Apply for a position
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}

const s = {
  shell:        { display: "flex", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" },

  // Left
  left:         { flex: "0 0 52%", background: "linear-gradient(145deg, #0041a8 0%, #0052cc 45%, #0066ff 100%)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" },
  leftInner:    { position: "relative", zIndex: 2, padding: "48px 56px", maxWidth: 520, width: "100%" },
  logoRow:      { marginBottom: 48 },
  hero:         { marginBottom: 40 },
  aiChip:       { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 999, marginBottom: 20, letterSpacing: "0.06em", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" },
  heroSub:      { margin: 0, fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, fontWeight: 500 },
  features:     { display: "flex", flexDirection: "column", gap: 20, marginBottom: 48 },
  featureRow:   { display: "flex", alignItems: "flex-start", gap: 14 },
  featureIcon:  { width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" },
  featureTitle: { margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#fff" },
  featureDesc:  { margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 },
  badge:        { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 },
  badgeDot:     { width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" },
  circle:       { position: "absolute", borderRadius: "50%", background: "#fff" },

  // Right
  right:        { flex: 1, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" },
  formCard:     { width: "100%", maxWidth: 400, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "40px 36px", boxShadow: "0 4px 32px rgba(0,0,0,0.07)" },
  formHeader:   { marginBottom: 28 },
  formTitle:    { margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "#111827" },
  formSub:      { margin: 0, fontSize: 13, color: "#6b7280" },
  form:         { display: "flex", flexDirection: "column", gap: 18 },
  field:        { display: "flex", flexDirection: "column", gap: 6 },
  label:        { fontSize: 12, fontWeight: 600, color: "#374151" },
  inputWrap:    { position: "relative", display: "flex", alignItems: "center" },
  inputIcon:    { position: "absolute", left: 12, display: "flex", alignItems: "center", pointerEvents: "none" },
  input:        { width: "100%", padding: "10px 12px 10px 38px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box", background: "#fafafa" },
  eyeBtn:       { position: "absolute", right: 12, background: "none", border: "none", fontSize: 11, fontWeight: 600, color: "#6b7280", cursor: "pointer", padding: 0 },
  errorBox:     { display: "flex", alignItems: "center", fontSize: 12, color: "#dc2626", background: "#fee2e2", border: "1px solid #fecaca", padding: "9px 12px", borderRadius: 7 },
  btn:          { padding: "12px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.01em" },
  spinner:      { width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" },
  applyLink:    { margin: "22px 0 0", fontSize: 13, color: "#6b7280", textAlign: "center" },
};
