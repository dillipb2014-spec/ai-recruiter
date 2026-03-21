"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import ScoreBadge from "@/components/ScoreBadge";
import CandidateDrawer from "@/components/CandidateDrawer";
import JobRolesModal from "@/components/JobRolesModal";
import FilterSidebar from "@/components/FilterSidebar";
import { useCandidateFilters } from "@/hooks/useCandidateFilters";
import {
  fetchCandidates, fetchJobRoles,
  bulkUploadCandidates, getBulkUploadStatus,
  bulkUpdateStatus, sendRejectionEmails,
  triggerBulkScan, getBulkScanStatus, sendScreeningTest,
} from "@/lib/api";

const STATUS_STYLE = {
  applied:                  { background: "#eff6ff", color: "#2563eb" },
  screening:                { background: "#fef3c7", color: "#d97706" },
  uploaded:                 { background: "#f0fdf4", color: "#15803d" },
  screen_select:            { background: "#ede9fe", color: "#4f46e5" },
  screen_reject:            { background: "#fee2e2", color: "#dc2626" },
  interview:                { background: "#f3e8ff", color: "#7c3aed" },
  evaluated:                { background: "#e0f2fe", color: "#0369a1" },
  hired:                    { background: "#dcfce7", color: "#15803d" },
  rejected:                 { background: "#fee2e2", color: "#dc2626" },
  "SCREEN_SELECT":          { background: "#dcfce7", color: "#15803d" },
  "SCREEN_REJECT":          { background: "#fee2e2", color: "#dc2626" },
  "PENDING RECRUITER ACTION": { background: "#fef3c7", color: "#d97706" },
  "REJECTED":               { background: "#fee2e2", color: "#dc2626" },
};

function DashboardInner() {
  const {
    filters, set, toggle, reset,
    activePills, removePill,
    saved, saveLabel, setSaveLabel, saveSearch, loadSearch, deleteSaved,
    apiParams,
  } = useCandidateFilters();

  const [candidates, setCandidates]   = useState([]);
  const [totalCount, setTotalCount]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [selected, setSelected]       = useState(null);
  const [showRoles, setShowRoles]     = useState(false);

  // Bulk re-scan
  const [scanConfirm, setScanConfirm]   = useState(false);
  const [scanState, setScanState]       = useState(null); // null | { total, pending, done, msg }
  const scanPollRef                     = useRef(null);

  // Selection for bulk ops
  const [checkedIds, setCheckedIds]   = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg]         = useState("");

  // Bulk upload
  const [roles, setRoles]                   = useState([]);
  const [bulkRoleId, setBulkRoleId]         = useState("");
  const [bulkFile, setBulkFile]             = useState(null);
  const [bulkUploading, setBulkUploading]   = useState(false);
  const [bulkResult, setBulkResult]         = useState(null);
  const [bulkUploadError, setBulkUploadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(""); setCheckedIds(new Set());
    try {
      const data = await fetchCandidates(apiParams);
      setCandidates(data);
      setTotalCount(data.length);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [apiParams]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { fetchJobRoles().then(setRoles).catch(() => {}); }, []);

  async function startBulkScan() {
    setScanConfirm(false);
    try {
      const { total, candidates: ids } = await triggerBulkScan();
      if (total === 0) { setScanState({ total: 0, pending: 0, done: 0, msg: "No candidates with resumes found" }); return; }
      setScanState({ total, pending: total, done: 0, msg: `Scanning\u2026 0/${total}` });
      scanPollRef.current = setInterval(async () => {
        try {
          const st = await getBulkScanStatus();
          const pending = parseInt(st.pending, 10);
          const done    = total - pending;
          if (pending === 0) {
            clearInterval(scanPollRef.current);
            setScanState({ total, pending: 0, done: total, msg: "\u2705 Scan complete" });
            load();
            setTimeout(() => setScanState(null), 4000);
          } else {
            setScanState({ total, pending, done, msg: `Scanning\u2026 ${done}/${total}` });
          }
        } catch { clearInterval(scanPollRef.current); }
      }, 3000);
      setTimeout(() => {
        clearInterval(scanPollRef.current);
        setScanState((s) => s && s.pending > 0 ? { ...s, msg: "\u26a0 Timed out \u2014 check results" } : s);
      }, 600000);
    } catch (err) {
      setScanState({ total: 0, pending: 0, done: 0, msg: `\u26a0 ${err.message}` });
    }
  }

  // Sort helpers
  function toggleSort(col) {
    if (filters.sort === col) set("order", filters.order === "desc" ? "asc" : "desc");
    else { set("sort", col); set("order", "desc"); }
  }
  const arrow = (col) => filters.sort === col ? (filters.order === "desc" ? " ↓" : " ↑") : "";

  // Checkbox helpers
  const allChecked = candidates.length > 0 && checkedIds.size === candidates.length;
  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(candidates.map((c) => c.id)));
  }
  function toggleOne(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Bulk reject
  async function handleBulkReject() {
    if (!checkedIds.size) return;
    setBulkLoading(true); setBulkMsg("");
    try {
      const ids = [...checkedIds];
      await bulkUpdateStatus(ids, "screen_reject");
      setBulkMsg(`✅ ${ids.length} candidate${ids.length > 1 ? "s" : ""} rejected`);
      load();
    } catch (e) { setBulkMsg(`⚠ ${e.message}`); }
    finally { setBulkLoading(false); }
  }

  // Manual select (for pending candidates)
  async function handleManualSelect(ids) {
    try {
      await bulkUpdateStatus(ids, "SCREEN_SELECT");
      load();
    } catch (e) { console.error(e); }
  }

  // Manual reject (for pending candidates)
  async function handleManualReject(ids) {
    try {
      await bulkUpdateStatus(ids, "REJECTED");
      load();
    } catch (e) { console.error(e); }
  }

  // Send rejection emails
  async function handleSendEmails() {
    if (!checkedIds.size) return;
    setBulkLoading(true); setBulkMsg("");
    try {
      const ids = [...checkedIds];
      const r   = await sendRejectionEmails(ids);
      setBulkMsg(`✅ Emails sent: ${r.sent}, failed: ${r.failed}`);
    } catch (e) { setBulkMsg(`⚠ ${e.message}`); }
    finally { setBulkLoading(false); }
  }

  // Bulk upload
  async function handleBulkUpload(e) {
    e.preventDefault();
    if (!bulkRoleId) return setBulkUploadError("Select a job role");
    if (!bulkFile)   return setBulkUploadError("Select an Excel file");
    setBulkUploading(true); setBulkUploadError(""); setBulkResult(null);
    try {
      const res = await bulkUploadCandidates(bulkRoleId, bulkFile);
      setBulkResult(res); setBulkFile(null);
      const poll = setInterval(async () => {
        const st = await getBulkUploadStatus(res.bulk_id);
        if (st.status === "completed") { clearInterval(poll); setBulkResult(st); load(); }
      }, 2000);
      setTimeout(() => clearInterval(poll), 60000);
    } catch (err) { setBulkUploadError(err.message); }
    finally { setBulkUploading(false); }
  }

  return (
    <div style={s.shell}>

      {/* ── Left Sidebar ── */}
      <FilterSidebar
        filters={filters} set={set} toggle={toggle} reset={reset}
        saved={saved} saveLabel={saveLabel} setSaveLabel={setSaveLabel}
        saveSearch={saveSearch} loadSearch={loadSearch} deleteSaved={deleteSaved}
      />

      {/* ── Main Content ── */}
      <div style={s.main}>

        {/* Top bar */}
        <div style={s.topbar}>
          <div>
            <h1 style={s.title}>JUSPAY <span style={s.titleAccent}>AI</span></h1>
            <p style={s.subtitle}>Recruiter Control Center</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setScanConfirm(true)}
              disabled={!!scanState}
              style={{ ...s.btnSecondary, opacity: scanState ? 0.5 : 1 }}
            >
              🔄 Re-scan All
            </button>
            <a href="/reports" style={s.btnSecondary}>📊 Reports</a>
            <button onClick={() => setShowRoles(true)} style={s.btnPrimary}>+ Job Roles</button>
          </div>
        </div>

        {/* Bulk Upload */}
        <div style={s.card}>
          <p style={s.cardLabel}>📥 BULK UPLOAD</p>
          <form onSubmit={handleBulkUpload} style={s.flexRow}>
            <select value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)} style={s.select}>
              <option value="">— Select Role —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <label style={s.fileLabel}>
              {bulkFile ? `📄 ${bulkFile.name}` : "Choose Excel / CSV"}
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                onChange={(e) => setBulkFile(e.target.files[0])} />
            </label>
            <button type="submit" disabled={bulkUploading} style={s.btnSecondary}>
              {bulkUploading ? "Uploading…" : "Upload"}
            </button>
          </form>
          {bulkUploadError && <p style={s.errText}>{bulkUploadError}</p>}
          {bulkResult && (
            <p style={s.okText}>
              {bulkResult.status === "completed"
                ? `✅ Done — ${bulkResult.processed} added, ${bulkResult.failed} skipped`
                : `⏳ Processing ${bulkResult.total} rows…`}
            </p>
          )}
          <p style={s.hintText}>Columns: <strong>Name, Email, Phone, Current_Location, Notice_Period, Position, Current_Company, Years_of_Experience, Current_CTC, Expected_CTC, LinkedIn_URL, Open_to_Relocation, Resume_Link</strong></p>
        </div>

        {/* Active Filter Pills */}
        {activePills.length > 0 && (
          <div style={s.pillsRow}>
            <span style={s.pillsLabel}>Active filters:</span>
            {activePills.map((p) => (
              <span key={p.key} style={s.pill}>
                {p.label}
                <button onClick={() => removePill(p.key)} style={s.pillX}>✕</button>
              </span>
            ))}
            <button onClick={reset} style={s.clearAll}>Clear all</button>
          </div>
        )}

        {/* Counter + Search */}
        <div style={s.tableHeader}>
          <div style={s.flexRow}>
            <input
              placeholder="Search name or email…"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              style={s.searchInput}
            />
            <span style={s.counter}>
              Showing <strong>{candidates.length}</strong>
              {totalCount !== candidates.length && ` of ${totalCount}`} candidates
            </span>
          </div>

          {/* Bulk action bar — appears when rows are checked */}
          {checkedIds.size > 0 && (
            <div style={s.bulkBar}>
              <span style={s.bulkCount}>{checkedIds.size} selected</span>
              <button onClick={handleBulkReject} disabled={bulkLoading} style={s.btnDanger}>
                {bulkLoading ? "…" : "✕ Bulk Reject"}
              </button>
              <button onClick={handleSendEmails} disabled={bulkLoading} style={s.btnSecondary}>
                {bulkLoading ? "…" : "✉ Send Rejection Emails"}
              </button>
              <button onClick={() => setCheckedIds(new Set())} style={s.btnGhost}>Deselect</button>
              {bulkMsg && <span style={{ fontSize: 13, color: bulkMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{bulkMsg}</span>}
            </div>
          )}
        </div>

        {error && <div style={s.errorBox}>⚠ {error}</div>}

        {/* Table */}
        {loading ? (
          <div style={s.empty}>Loading candidates…</div>
        ) : candidates.length === 0 ? (
          <div style={s.empty}>No candidates match the current filters.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={{ ...s.th, width: 36 }}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th style={s.th} onClick={() => toggleSort("full_name")}>Name{arrow("full_name")}</th>
                  <th style={s.th}>Company</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th} onClick={() => toggleSort("overall_score")}>Score{arrow("overall_score")}</th>
                  <th style={s.th}>Exp CTC</th>
                  <th style={s.th} onClick={() => toggleSort("created_at")}>Applied{arrow("created_at")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => {
                  const checked = checkedIds.has(c.id);
                  return (
                    <tr key={c.id}
                      onClick={() => setSelected(c)}
                      style={{ background: checkedIds.has(c.id) ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#f9fafb", cursor: "pointer" }}>
                      <td style={s.td} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(c.id)} />
                      </td>
                      <td style={{ ...s.td, fontWeight: 600, color: "#111827" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {c.full_name}
                          {c.linkedin_url && c.linkedin_url.includes("linkedin.com") && (
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#0052cc", lineHeight: 1, flexShrink: 0 }}
                              title="LinkedIn Profile">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{c.email}</div>
                      </td>
                      <td style={{ ...s.td, color: "#6b7280", fontSize: 12 }}>{c.current_company || "—"}</td>
                      <td style={{ ...s.td, color: "#6b7280" }}>{c.job_role_title || "—"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ ...s.statusPill, ...(STATUS_STYLE[c.status] || {}) }}>
                            {c.status === "screen_select" || c.status === "SCREEN_SELECT" ? "Screen Select"
                              : c.status === "screen_reject" || c.status === "SCREEN_REJECT" ? "Screen Reject"
                              : c.status === "PENDING RECRUITER ACTION" ? "Pending"
                              : c.status === "uploaded" ? "Uploaded"
                              : c.status?.replace(/_/g, " ")}
                          </span>
                          {c.status === "uploaded" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); sendScreeningTest(c.id).then(load).catch(() => {}); }}
                              style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, background: "#0052cc", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap" }}
                            >▶ Send Screening Test</button>
                          )}
                        </div>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                            <span style={{ color: "#6b7280", width: 50 }}>Resume</span>
                            <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${c.resume_score || 0}%`, height: "100%", background: (c.resume_score || 0) >= 50 ? "#16a34a" : "#dc2626" }} />
                            </div>
                            <span style={{ fontSize: 10, width: 30 }}>{c.resume_score || 0}%</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                            <span style={{ color: "#6b7280", width: 50 }}>Screening</span>
                            <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${c.overall_score || 0}%`, height: "100%", background: (c.overall_score || 0) >= 50 ? "#16a34a" : "#dc2626" }} />
                            </div>
                            <span style={{ fontSize: 10, width: 30 }}>{c.overall_score || 0}%</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...s.td, color: "#6b7280" }}>
                        {c.expected_ctc ? `₹${c.expected_ctc} L` : c.experience_years != null ? `${c.experience_years} yr` : "—"}
                      </td>
                      <td style={{ ...s.td, color: "#6b7280" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CandidateDrawer candidate={selected} onClose={() => setSelected(null)} onRescreen={load} />
      {showRoles && <JobRolesModal onClose={() => { setShowRoles(false); fetchJobRoles().then(setRoles).catch(() => {}); }} />}

      {/* ── Confirm Modal ── */}
      {scanConfirm && (
        <>
          <div onClick={() => setScanConfirm(false)} style={s.overlay} />
          <div style={s.modal}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Re-scan All Candidates?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              This will re-scan <strong>{candidates.length}</strong> candidate{candidates.length !== 1 ? "s" : ""} using the current JD and Ollama AI.
              This may take a few minutes. Proceed?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setScanConfirm(false)} style={s.btnGhost}>Cancel</button>
              <button onClick={startBulkScan} style={s.btnPrimary}>Yes, Re-scan</button>
            </div>
          </div>
        </>
      )}

      {/* ── Progress Toast ── */}
      {scanState && (
        <div style={s.toast}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{scanState.msg}</span>
            {scanState.pending === 0 && (
              <button onClick={() => setScanState(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6b7280" }}>✕</button>
            )}
          </div>
          {scanState.total > 0 && (
            <div style={{ height: 4, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((scanState.done / scanState.total) * 100)}%`, background: "#0052cc", borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
          )}
          {scanState.total > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>{scanState.done} of {scanState.total} processed</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#9ca3af" }}>Loading…</div>}>
      <DashboardInner />
    </Suspense>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  shell:       { display: "flex", height: "100vh", overflow: "hidden", background: "#f9fafb" },
  main:        { flex: 1, padding: "24px 32px", minWidth: 0, overflowY: "auto", overflowX: "hidden" },
  topbar:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title:       { margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" },
  titleAccent: { color: "#0052cc" },
  subtitle:    { margin: "2px 0 0", fontSize: 12, color: "#9ca3af" },
  card:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 18px", marginBottom: 16 },
  cardLabel:   { margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em" },
  flexRow:     { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  row:         { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  select:      { padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, background: "#fff", cursor: "pointer", minWidth: 180 },
  fileLabel:   { padding: "7px 14px", border: "1px dashed #d1d5db", borderRadius: 7, fontSize: 12, color: "#6b7280", cursor: "pointer", background: "#fafafa" },
  errText:     { margin: "8px 0 0", fontSize: 12, color: "#dc2626" },
  okText:      { margin: "8px 0 0", fontSize: 12, color: "#16a34a" },
  hintText:    { margin: "6px 0 0", fontSize: 11, color: "#9ca3af" },
  pillsRow:    { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 },
  pillsLabel:  { fontSize: 12, color: "#6b7280", fontWeight: 500 },
  pill:        { display: "inline-flex", alignItems: "center", gap: 4, background: "#e6f0ff", color: "#0052cc", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999 },
  pillX:       { background: "none", border: "none", cursor: "pointer", color: "#0052cc", fontSize: 11, padding: 0, lineHeight: 1 },
  clearAll:    { fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" },
  tableHeader: { marginBottom: 12 },
  searchInput: { padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, width: 280, outline: "none" },
  counter:     { fontSize: 13, color: "#6b7280", marginLeft: "auto" },
  bulkBar:     { display: "flex", gap: 8, alignItems: "center", marginTop: 10, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8 },
  bulkCount:   { fontSize: 13, fontWeight: 600, color: "#92400e" },
  btnPrimary:  { padding: "8px 18px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnSecondary:{ padding: "7px 14px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" },
  btnDanger:   { padding: "7px 14px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnGhost:    { padding: "7px 14px", background: "none", color: "#6b7280", border: "none", fontSize: 13, cursor: "pointer" },
  tableWrap:   { overflowX: "auto", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", background: "#fff", border: "1px solid #e5e7eb", marginBottom: 32 },
  table:       { width: "100%", borderCollapse: "collapse" },
  thead:       { background: "#f3f4f6" },
  th:          { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" },
  td:          { padding: "12px 14px", fontSize: 13, borderTop: "1px solid #f3f4f6", verticalAlign: "middle" },
  trEven:      { background: "#fff" },
  trOdd:       { background: "#f9fafb" },
  trChecked:   { background: "#eff6ff" },
  statusPill:  { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  errorBox:    { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", color: "#dc2626", marginBottom: 14, fontSize: 13 },
  empty:       { textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 14 },
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 },
  modal:       { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#fff", borderRadius: 12, padding: "24px 28px", width: 400, zIndex: 70, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" },
  toast:       { position: "fixed", bottom: 24, right: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 18px", width: 280, zIndex: 80, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
};
