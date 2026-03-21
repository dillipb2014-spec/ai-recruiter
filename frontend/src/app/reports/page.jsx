"use client";
import { useEffect, useState } from "react";
import { fetchCandidates, fetchJobRoles } from "@/lib/api";

const STATUS_LABEL = {
  applied: "Applied", screening: "Screening",
  screen_select: "Screen Select", screen_reject: "Screen Reject",
  interview: "Interview", evaluated: "Evaluated",
  hired: "Hired", rejected: "Rejected",
};

const STATUS_COLOR = {
  applied: "#2563eb", screening: "#d97706",
  screen_select: "#4f46e5", screen_reject: "#dc2626",
  interview: "#7c3aed", evaluated: "#0369a1",
  hired: "#16a34a", rejected: "#dc2626",
};

const STATUS_BG = {
  applied: "#eff6ff", screening: "#fef3c7",
  screen_select: "#ede9fe", screen_reject: "#fee2e2",
  interview: "#f3e8ff", evaluated: "#e0f2fe",
  hired: "#dcfce7", rejected: "#fee2e2",
};

const PIPELINE = ["applied", "screening", "screen_select", "interview", "evaluated", "hired"];

export default function ReportsPage() {
  const [candidates, setCandidates] = useState([]);
  const [roles, setRoles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    Promise.all([fetchCandidates({}), fetchJobRoles()])
      .then(([c, r]) => { setCandidates(c); setRoles(r); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = roleFilter ? candidates.filter((c) => c.job_role_id === roleFilter) : candidates;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total      = filtered.length;
  const screened   = filtered.filter((c) => c.resume_score != null || c.overall_score != null).length;
  const selected   = filtered.filter((c) => c.status === "screen_select" || c.status === "hired" || c.status === "interview" || c.status === "evaluated").length;
  const hired      = filtered.filter((c) => c.status === "hired").length;
  const rejected   = filtered.filter((c) => c.status === "screen_reject" || c.status === "rejected").length;
  const scores     = filtered.map((c) => parseFloat(c.overall_score ?? c.resume_score ?? 0)).filter((s) => s > 0);
  const avgScore   = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const passRate   = screened > 0 ? ((selected / screened) * 100).toFixed(0) : "—";

  // ── Pipeline counts ────────────────────────────────────────────────────────
  const pipelineCounts = PIPELINE.map((s) => ({
    status: s,
    count: filtered.filter((c) => c.status === s).length,
  }));
  const maxCount = Math.max(...pipelineCounts.map((p) => p.count), 1);

  // ── By role ────────────────────────────────────────────────────────────────
  const byRole = roles.map((r) => {
    const rc = candidates.filter((c) => c.job_role_id === r.id);
    const rs = rc.map((c) => parseFloat(c.overall_score ?? c.resume_score ?? 0)).filter((s) => s > 0);
    return {
      title: r.title,
      total: rc.length,
      selected: rc.filter((c) => ["screen_select","interview","evaluated","hired"].includes(c.status)).length,
      hired: rc.filter((c) => c.status === "hired").length,
      avgScore: rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1) : "—",
    };
  }).filter((r) => r.total > 0);

  // ── Score distribution ─────────────────────────────────────────────────────
  const scoreBuckets = [
    { label: "< 50", count: scores.filter((s) => s < 50).length, color: "#dc2626" },
    { label: "50–74", count: scores.filter((s) => s >= 50 && s < 75).length, color: "#d97706" },
    { label: "≥ 75", count: scores.filter((s) => s >= 75).length, color: "#16a34a" },
  ];

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Name", "Email", "Company", "Role", "Status", "Score", "Experience (yrs)", "Current CTC", "Expected CTC", "Notice Period", "Decision Insight", "Applied"];
    const rows = filtered.map((c) => [
      c.full_name, c.email, c.current_company || "",
      c.job_role_title || "", c.status,
      c.overall_score ?? c.resume_score ?? "",
      c.experience_years ?? "",
      c.current_ctc ?? "", c.expected_ctc ?? "",
      c.notice_period || "",
      (c.ai_decision_insight || "").replace(/,/g, ";"),
      new Date(c.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `juspay-ai-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (loading) return <div style={s.shell}><div style={s.main}><p style={{ color: "#9ca3af", fontSize: 14 }}>Loading report…</p></div></div>;

  return (
    <div style={s.shell}>
      <div style={s.main}>

        {/* Header */}
        <div style={s.topbar}>
          <div>
            <h1 style={s.title}>JUSPAY <span style={{ color: "#0052cc" }}>AI</span></h1>
            <p style={s.subtitle}>Recruitment Report</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={s.select}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <button onClick={exportCSV} style={s.btnPrimary}>⬇ Export CSV</button>
            <a href="/dashboard" style={s.btnSecondary}>← Dashboard</a>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={s.kpiRow}>
          {[
            { label: "Total Applicants", value: total, color: "#0052cc" },
            { label: "AI Screened", value: screened, color: "#7c3aed" },
            { label: "Screen Selected", value: selected, color: "#4f46e5" },
            { label: "Rejected", value: rejected, color: "#dc2626" },
            { label: "Hired", value: hired, color: "#16a34a" },
            { label: "Avg AI Score", value: avgScore, color: "#d97706" },
            { label: "Pass Rate", value: passRate === "—" ? "—" : `${passRate}%`, color: "#0369a1" },
          ].map((k) => (
            <div key={k.label} style={s.kpiCard}>
              <p style={s.kpiLabel}>{k.label}</p>
              <p style={{ ...s.kpiValue, color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div style={s.row}>
          {/* Pipeline Funnel */}
          <div style={{ ...s.card, flex: 2 }}>
            <p style={s.sectionLabel}>PIPELINE FUNNEL</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pipelineCounts.map((p) => (
                <div key={p.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 100, fontSize: 12, color: "#6b7280", flexShrink: 0 }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <div style={{ flex: 1, height: 22, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(p.count / maxCount) * 100}%`,
                      background: STATUS_BG[p.status],
                      borderLeft: `3px solid ${STATUS_COLOR[p.status]}`,
                      transition: "width 0.4s ease",
                      minWidth: p.count > 0 ? 4 : 0,
                    }} />
                  </div>
                  <span style={{ width: 28, fontSize: 13, fontWeight: 700, color: STATUS_COLOR[p.status], textAlign: "right", flexShrink: 0 }}>
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Score Distribution */}
          <div style={{ ...s.card, flex: 1 }}>
            <p style={s.sectionLabel}>SCORE DISTRIBUTION</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scoreBuckets.map((b) => (
                <div key={b.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{b.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.count}</span>
                  </div>
                  <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${scores.length ? (b.count / scores.length) * 100 : 0}%`,
                      background: b.color,
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>{scores.length} candidates scored</p>
            </div>
          </div>
        </div>

        {/* By Role */}
        {byRole.length > 0 && (
          <div style={s.card}>
            <p style={s.sectionLabel}>BY JOB ROLE</p>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  {["Role", "Total", "Selected", "Hired", "Avg Score", "Conversion"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byRole.map((r, i) => (
                  <tr key={r.title} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ ...s.td, fontWeight: 600, color: "#111827" }}>{r.title}</td>
                    <td style={s.td}>{r.total}</td>
                    <td style={{ ...s.td, color: "#4f46e5", fontWeight: 600 }}>{r.selected}</td>
                    <td style={{ ...s.td, color: "#16a34a", fontWeight: 600 }}>{r.hired}</td>
                    <td style={s.td}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: r.avgScore === "—" ? "#f3f4f6" : parseFloat(r.avgScore) >= 75 ? "#dcfce7" : parseFloat(r.avgScore) >= 50 ? "#fef3c7" : "#fee2e2",
                        color: r.avgScore === "—" ? "#9ca3af" : parseFloat(r.avgScore) >= 75 ? "#16a34a" : parseFloat(r.avgScore) >= 50 ? "#d97706" : "#dc2626",
                      }}>{r.avgScore}{r.avgScore !== "—" ? "%" : ""}</span>
                    </td>
                    <td style={s.td}>
                      {r.total > 0 ? `${((r.selected / r.total) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Candidate Table */}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ ...s.sectionLabel, margin: 0 }}>ALL CANDIDATES ({filtered.length})</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  {["Name", "Email", "Company", "Role", "Status", "Score", "Exp", "CTC (Curr / Exp)", "Notice", "Applied", "AI Insight"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const score = c.overall_score != null ? parseFloat(c.overall_score) : c.resume_score != null ? parseFloat(c.resume_score) : null;
                  const scoreColor = score == null ? "#9ca3af" : score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
                  const scoreBg   = score == null ? "#f3f4f6" : score >= 75 ? "#dcfce7" : score >= 50 ? "#fef3c7" : "#fee2e2";
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ ...s.td, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{c.full_name}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12 }}>{c.email}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12 }}>{c.current_company || "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{c.job_role_title || "—"}</td>
                      <td style={s.td}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: STATUS_BG[c.status] || "#f3f4f6", color: STATUS_COLOR[c.status] || "#6b7280", whiteSpace: "nowrap" }}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td style={s.td}>
                        {score != null
                          ? <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: scoreBg, color: scoreColor }}>{score}%</span>
                          : <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12 }}>{c.experience_years != null ? `${c.experience_years} yr` : "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                        {c.current_ctc ? `₹${c.current_ctc}L` : "—"} / {c.expected_ctc ? `₹${c.expected_ctc}L` : "—"}
                      </td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{c.notice_period || "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ ...s.td, fontSize: 11, color: c.ai_decision_insight?.startsWith("Pro:") ? "#16a34a" : c.ai_decision_insight?.startsWith("Con:") ? "#dc2626" : "#9ca3af", maxWidth: 220 }}>
                        {c.ai_decision_insight || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
          Generated {new Date().toLocaleString()} · JUSPAY AI Recruitment
        </p>
      </div>
    </div>
  );
}

const s = {
  shell:      { minHeight: "100vh", background: "#f9fafb" },
  main:       { padding: "24px 32px", maxWidth: 1400, margin: "0 auto" },
  topbar:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title:      { margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" },
  subtitle:   { margin: "2px 0 0", fontSize: 12, color: "#9ca3af" },
  select:     { padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, background: "#fff", cursor: "pointer" },
  btnPrimary: { padding: "8px 16px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  btnSecondary:{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  kpiRow:     { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  kpiCard:    { flex: 1, minWidth: 110, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" },
  kpiLabel:   { margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  kpiValue:   { margin: 0, fontSize: 26, fontWeight: 700 },
  row:        { display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" },
  card:       { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 16 },
  sectionLabel:{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" },
  table:      { width: "100%", borderCollapse: "collapse" },
  thead:      { background: "#f3f4f6" },
  th:         { padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" },
  td:         { padding: "10px 12px", fontSize: 13, borderTop: "1px solid #f3f4f6", verticalAlign: "middle" },
};
