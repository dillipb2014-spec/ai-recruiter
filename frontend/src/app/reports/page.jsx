"use client";
import { useEffect, useState } from "react";
import { fetchCandidates, fetchJobRoles } from "@/lib/api";

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const STATUS_LABEL = {
  applied: "Applied", screening: "Screening",
  screen_select: "Screen Select", screen_reject: "Screen Reject",
  interview: "Interview", evaluated: "Evaluated",
  hired: "Hired", rejected: "Rejected",
};
const STATUS_PILL = {
  applied:       { bg: "#eff6ff", color: "#1d4ed8" },
  screening:     { bg: "#fef3c7", color: "#d97706" },
  screen_select: { bg: "#ede9fe", color: "#7c3aed" },
  screen_reject: { bg: "#fee2e2", color: "#dc2626" },
  interview:     { bg: "#f3e8ff", color: "#7c3aed" },
  evaluated:     { bg: "#e0f2fe", color: "#0369a1" },
  hired:         { bg: "#dcfce7", color: "#16a34a" },
  rejected:      { bg: "#fee2e2", color: "#dc2626" },
};
const PIPELINE = ["applied","screening","screen_select","screen_reject","interview","evaluated","hired","rejected"];
const PIPELINE_COLOR = {
  applied: "#3b82f6", screening: "#f59e0b", screen_select: "#8b5cf6",
  screen_reject: "#ef4444", interview: "#a855f7", evaluated: "#0ea5e9",
  hired: "#22c55e", rejected: "#ef4444",
};

function ReadMore({ text }) {
  const [open, setOpen] = useState(false);
  if (!text || text === "—") return <span style={{ color: "#9ca3af" }}>—</span>;
  const short = text.length > 80;
  return (
    <div style={{ verticalAlign: "top" }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "#374151",
        display: open ? "block" : "-webkit-box",
        WebkitLineClamp: open ? "unset" : 2,
        WebkitBoxOrient: "vertical",
        overflow: open ? "visible" : "hidden",
      }}>{text}</p>
      {short && (
        <button onClick={() => setOpen(v => !v)}
          style={{ marginTop: 2, fontSize: 11, color: "#0052cc", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
          {open ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color = "#111827" }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>{sub}</p>}
    </div>
  );
}

function HBar({ label, value, max, color, count }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      </div>
      <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [candidates, setCandidates] = useState([]);
  const [roles, setRoles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [sortCol, setSortCol]       = useState("score");
  const [sortDir, setSortDir]       = useState("desc");

  useEffect(() => {
    Promise.all([fetchCandidates({}), fetchJobRoles()])
      .then(([c, r]) => { setCandidates(c); setRoles(r); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = roleFilter ? candidates.filter(c => c.job_role_id === roleFilter) : candidates;

  // ── KPIs ──
  const total    = filtered.length;
  const screened = filtered.filter(c => c.resume_score != null).length;
  const selected = filtered.filter(c => ["screen_select","interview","evaluated","hired"].includes(c.status)).length;
  const hired    = filtered.filter(c => c.status === "hired").length;
  const rejected = filtered.filter(c => ["screen_reject","rejected"].includes(c.status)).length;
  const scores   = filtered.map(c => parseFloat(c.overall_score ?? c.resume_score ?? 0)).filter(s => s > 0);
  const avgScore = scores.length ? (scores.reduce((a,b) => a+b,0) / scores.length).toFixed(1) : "—";
  const passRate = screened > 0 ? ((selected / screened) * 100).toFixed(0) + "%" : "—";
  const topScore = scores.length ? Math.max(...scores).toFixed(1) : "—";

  // ── Pipeline ──
  const pipelineCounts = PIPELINE.map(s => ({ status: s, count: filtered.filter(c => c.status === s).length }));
  const maxPipeline    = Math.max(...pipelineCounts.map(p => p.count), 1);

  // ── Score distribution ──
  const buckets = [
    { label: "Strong (≥75)",   count: scores.filter(s => s >= 75).length,              color: "#16a34a", bg: "#dcfce7" },
    { label: "Good (50–74)",   count: scores.filter(s => s >= 50 && s < 75).length,    color: "#d97706", bg: "#fef3c7" },
    { label: "Weak (<50)",     count: scores.filter(s => s < 50).length,               color: "#dc2626", bg: "#fee2e2" },
  ];

  // ── By role ──
  const byRole = roles.map(r => {
    const rc = candidates.filter(c => c.job_role_id === r.id);
    const rs = rc.map(c => parseFloat(c.overall_score ?? c.resume_score ?? 0)).filter(s => s > 0);
    const sel = rc.filter(c => ["screen_select","interview","evaluated","hired"].includes(c.status)).length;
    return {
      title: r.title, total: rc.length, selected: sel,
      convRate: rc.length ? ((sel / rc.length) * 100).toFixed(0) : "0",
      avgScore: rs.length ? (rs.reduce((a,b) => a+b,0) / rs.length).toFixed(1) : "—",
    };
  }).filter(r => r.total > 0).sort((a,b) => b.total - a.total);

  // ── Table sort ──
  const getScore = c => parseFloat(c.overall_score ?? c.resume_score ?? 0);
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortCol === "score")   { av = getScore(a); bv = getScore(b); }
    else if (sortCol === "name")   { av = a.full_name || ""; bv = b.full_name || ""; }
    else if (sortCol === "status") { av = a.status || ""; bv = b.status || ""; }
    else if (sortCol === "date")   { av = new Date(a.created_at); bv = new Date(b.created_at); }
    else { av = 0; bv = 0; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }
  const arrow = col => sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  // ── Export ──
  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Candidates");
    ws.columns = [
      { header: "Name",          key: "name",    width: 24 },
      { header: "Email",         key: "email",   width: 30 },
      { header: "Role",          key: "role",    width: 22 },
      { header: "Status",        key: "status",  width: 18 },
      { header: "Score",         key: "score",   width: 10 },
      { header: "Exp (yrs)",     key: "exp",     width: 10 },
      { header: "Current CTC",   key: "cctc",    width: 14 },
      { header: "Expected CTC",  key: "ectc",    width: 14 },
      { header: "Notice",        key: "notice",  width: 14 },
      { header: "Applied",       key: "applied", width: 14 },
      { header: "AI Insight",    key: "insight", width: 60 },
    ];
    const hr = ws.getRow(1);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0052CC" } };
    hr.height = 20;
    filtered.forEach(c => {
      const score = c.overall_score != null ? parseFloat(c.overall_score) : c.resume_score != null ? parseFloat(c.resume_score) : null;
      ws.addRow({ name: c.full_name||"", email: c.email||"", role: c.job_role_title||"", status: STATUS_LABEL[c.status]||c.status||"", score: score??"", exp: c.experience_years??"", cctc: c.current_ctc??"", ectc: c.expected_ctc??"", notice: c.notice_period||"", applied: new Date(c.created_at).toLocaleDateString(), insight: c.ai_decision_insight||"" });
    });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `juspay-ai-recruiter-report-${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 32px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>
              Juspay <span style={{ color: "#0052cc" }}>AI</span>
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Recruitment Analytics Dashboard</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              style={{ padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, background: "#fff", color: "#374151", cursor: "pointer" }}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <button onClick={exportExcel}
              style={{ padding: "8px 16px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ⬇ Export Excel
            </button>
            <a href="/dashboard"
              style={{ padding: "8px 16px", background: "#fff", color: "#0052cc", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              ← Dashboard
            </a>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <KpiCard label="Total Applicants" value={total} />
          <KpiCard label="AI Screened"      value={screened} sub={`${total > 0 ? ((screened/total)*100).toFixed(0) : 0}% of total`} />
          <KpiCard label="Screen Selected"  value={selected} color="#7c3aed" />
          <KpiCard label="Rejected"         value={rejected} color="#dc2626" />
          <KpiCard label="Avg AI Score"     value={avgScore !== "—" ? `${avgScore}%` : "—"} color="#0052cc" />
          <KpiCard label="Pass Rate"        value={passRate} sub="selected / screened" color="#16a34a" />
          <KpiCard label="Top Score"        value={topScore !== "—" ? `${topScore}%` : "—"} color="#d97706" />
        </div>

        {/* ── 3-col analytics row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>

          {/* Pipeline Funnel */}
          <div style={card}>
            <p style={sectionLabel}>PIPELINE FUNNEL</p>
            {pipelineCounts.filter(p => p.count > 0 || ["applied","screening","screen_select","hired"].includes(p.status)).map(({ status, count }) => (
              <HBar key={status} label={STATUS_LABEL[status]} value={count} max={maxPipeline}
                color={PIPELINE_COLOR[status]} count={count} />
            ))}
          </div>

          {/* Score Distribution */}
          <div style={card}>
            <p style={sectionLabel}>SCORE DISTRIBUTION</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {buckets.map(b => (
                <div key={b.label} style={{ flex: 1, background: b.bg, borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: b.color }}>{b.count}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 600, color: b.color, textTransform: "uppercase" }}>{b.label}</p>
                </div>
              ))}
            </div>
            {buckets.map(b => (
              <HBar key={b.label} label={b.label} value={b.count} max={scores.length || 1}
                color={b.color} count={`${scores.length ? ((b.count/scores.length)*100).toFixed(0) : 0}%`} />
            ))}
          </div>

          {/* By Role */}
          <div style={card}>
            <p style={sectionLabel}>BY ROLE</p>
            {byRole.length === 0
              ? <p style={{ fontSize: 12, color: "#9ca3af" }}>No role data</p>
              : byRole.map(r => (
                <div key={r.title} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{r.selected}/{r.total} · avg {r.avgScore}%</span>
                  </div>
                  <div style={{ height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.convRate}%`, background: "#0052cc", borderRadius: 999 }} />
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#9ca3af" }}>{r.convRate}% conversion</p>
                </div>
              ))
            }
          </div>

        </div>

        {/* ── Candidates Table ── */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ ...sectionLabel, margin: 0 }}>ALL CANDIDATES</p>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{filtered.length} records</span>
          </div>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 420px)" }} className="thin-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }}  />
                <col style={{ width: "9%" }}  />
                <col style={{ width: "9%" }}  />
                <col style={{ width: "5%" }}  />
                <col style={{ width: "4%" }}  />
                <col style={{ width: "7%" }}  />
                <col style={{ width: "6%" }}  />
                <col style={{ width: "6%" }}  />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    { key: "name",   label: "Name" },
                    { key: null,     label: "Email" },
                    { key: null,     label: "Company" },
                    { key: null,     label: "Role" },
                    { key: "status", label: "Status" },
                    { key: "score",  label: "Score" },
                    { key: null,     label: "Exp" },
                    { key: null,     label: "CTC (C/E)" },
                    { key: null,     label: "Notice" },
                    { key: "date",   label: "Applied" },
                    { key: null,     label: "AI Insight" },
                  ].map(({ key, label }) => (
                    <th key={label}
                      onClick={key ? () => toggleSort(key) : undefined}
                      style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb", cursor: key ? "pointer" : "default", userSelect: "none", position: "sticky", top: 0, background: "#f9fafb", zIndex: 10 }}>
                      {label}{key ? arrow(key) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => {
                  const score = c.overall_score != null ? parseFloat(c.overall_score) : c.resume_score != null ? parseFloat(c.resume_score) : null;
                  const sc = score == null ? null : score >= 75 ? { color: "#16a34a", bg: "#dcfce7" } : score >= 50 ? { color: "#d97706", bg: "#fef3c7" } : { color: "#dc2626", bg: "#fee2e2" };
                  const pill = STATUS_PILL[c.status] || { bg: "#f3f4f6", color: "#6b7280" };
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                      <td style={td}><span style={{ fontWeight: 600, color: "#111827" }}>{c.full_name}</span></td>
                      <td style={td}>{c.email}</td>
                      <td style={td}>{c.current_company || "—"}</td>
                      <td style={td}>{c.job_role_title || "—"}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: pill.bg, color: pill.color, whiteSpace: "nowrap" }}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {sc
                          ? <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.color }}>{score.toFixed(1)}%</span>
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ ...td, color: "#6b7280", textAlign: "center" }}>{c.experience_years != null ? `${c.experience_years}y` : "—"}</td>
                      <td style={{ ...td, color: "#6b7280", textAlign: "center", whiteSpace: "nowrap" }}>
                        {c.current_ctc ? `₹${c.current_ctc}L` : "—"} / {c.expected_ctc ? `₹${c.expected_ctc}L` : "—"}
                      </td>
                      <td style={{ ...td, color: "#6b7280", whiteSpace: "nowrap" }}>{c.notice_period || "—"}</td>
                      <td style={{ ...td, color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                      <td style={{ ...td, whiteSpace: "normal", minWidth: 200 }}><ReadMore text={c.ai_decision_insight} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 12 }}>
          Generated {new Date().toLocaleString("en-IN")} · Juspay AI
        </p>
      </div>

      <style>{`
        .thin-scroll { scrollbar-width: thin; scrollbar-color: #e5e7eb transparent; }
        .thin-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .thin-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 999px; }
      `}</style>
    </div>
  );
}

const card        = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" };
const sectionLabel = { margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" };
const td = { padding: "11px 16px", fontSize: 13, verticalAlign: "middle", color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
