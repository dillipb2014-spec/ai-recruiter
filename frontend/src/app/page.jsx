"use client";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats]     = useState(null);

  useEffect(() => {
    setVisible(true);
    fetch("http://localhost:4000/api/candidates")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setStats({
          total:    data.length,
          selected: data.filter((c) => c.status === "screen_select" || c.status === "hired").length,
          hired:    data.filter((c) => c.status === "hired").length,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <main style={s.bg}>
      <div style={s.grid} />

      <div style={{ ...s.card, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}>
        <div style={s.brand}>
          <span style={s.brandName}>JUSPAY</span>
          <span style={s.brandAi}>AI</span>
        </div>

        <div style={s.divider} />

        <h1 style={s.title}>AI-Powered Recruitment</h1>
        <p style={s.tagline}>Intelligent candidate screening and evaluation powered by Ollama</p>

        {stats && (
          <div style={s.statsRow}>
            {[
              { label: "Total Applied", value: stats.total },
              { label: "Selected",      value: stats.selected },
              { label: "Hired",         value: stats.hired },
            ].map((st) => (
              <div key={st.label} style={s.statBox}>
                <p style={s.statVal}>{st.value}</p>
                <p style={s.statLabel}>{st.label}</p>
              </div>
            ))}
          </div>
        )}

        <div style={s.btnCol}>
          <a href="/apply" style={s.btnPrimary}>Apply for a Position →</a>
          <a href="/dashboard" style={s.btnSecondary}>Recruiter Login</a>
        </div>
      </div>
    </main>
  );
}

const s = {
  bg:        { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0c1445 100%)", position: "relative", overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" },
  grid:      { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" },
  card:      { position: "relative", zIndex: 1, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "48px 40px", maxWidth: 480, width: "90%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", transition: "opacity 0.6s ease, transform 0.6s ease" },
  brand:     { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 12 },
  brandName: { fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.12em" },
  brandAi:   { fontSize: 14, fontWeight: 700, color: "#818cf8", letterSpacing: "0.12em" },
  divider:   { width: 32, height: 2, background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: 999, margin: "0 auto 24px" },
  title:     { margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  tagline:   { margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 },
  statsRow:  { display: "flex", gap: 12, marginBottom: 28, justifyContent: "center" },
  statBox:   { flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 8px" },
  statVal:   { margin: "0 0 2px", fontSize: 22, fontWeight: 700, color: "#818cf8" },
  statLabel: { margin: 0, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" },
  btnCol:    { display: "flex", flexDirection: "column", gap: 12 },
  btnPrimary:  { display: "block", padding: "14px 24px", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" },
  btnSecondary:{ display: "block", padding: "14px 24px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none" },
};
