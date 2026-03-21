"use client";
import ScoreBadge from "./ScoreBadge";

const STATUS_COLORS = {
  applied:   { bg: "#f3f4f6", color: "#374151" },
  screening: { bg: "#fef3c7", color: "#d97706" },
  interview: { bg: "#dbeafe", color: "#2563eb" },
  evaluated: { bg: "#ede9fe", color: "#7c3aed" },
  hired:     { bg: "#dcfce7", color: "#16a34a" },
  rejected:  { bg: "#fee2e2", color: "#dc2626" },
};

export default function CandidateTable({ candidates, sortKey, sortOrder, onSort, onSelect }) {
  const cols = [
    { key: "rank",               label: "#",            sortable: false },
    { key: "full_name",          label: "Candidate",    sortable: true  },
    { key: "status",             label: "Status",       sortable: false },
    { key: "resume_score",       label: "Resume",       sortable: true  },
    { key: "technical_score",    label: "Technical",    sortable: true  },
    { key: "communication_score",label: "Communication",sortable: true  },
    { key: "overall_score",      label: "Overall",      sortable: true  },
    { key: "ai_recommendation",  label: "AI Decision",  sortable: false },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSort(col.key)}
                style={{ ...styles.th, cursor: col.sortable ? "pointer" : "default" }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (sortOrder === "desc" ? " ↓" : " ↑")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.length === 0 && (
            <tr><td colSpan={cols.length} style={styles.empty}>No candidates found</td></tr>
          )}
          {candidates.map((c, i) => {
            const st = STATUS_COLORS[c.status] || STATUS_COLORS.applied;
            const rec = c.ai_recommendation;
            const recColor = rec === "hire" ? "#16a34a" : rec === "hold" ? "#d97706" : rec === "reject" ? "#dc2626" : "#9ca3af";
            return (
              <tr key={c.id} onClick={() => onSelect(c)} style={styles.row}>
                <td style={styles.td}>{i + 1}</td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{c.full_name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{c.email}</div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.statusBadge, background: st.bg, color: st.color }}>
                    {c.status}
                  </span>
                </td>
                <td style={styles.td}><ScoreBadge score={c.resume_score ? parseFloat(c.resume_score) : null} /></td>
                <td style={styles.td}><ScoreBadge score={c.technical_score ? parseFloat(c.technical_score) : null} /></td>
                <td style={styles.td}><ScoreBadge score={c.communication_score ? parseFloat(c.communication_score) : null} /></td>
                <td style={styles.td}><ScoreBadge score={c.overall_score ? parseFloat(c.overall_score) : null} /></td>
                <td style={styles.td}>
                  {rec ? <span style={{ fontWeight: 600, color: recColor, textTransform: "capitalize" }}>{rec}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table:       { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th:          { padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #f3f4f6", whiteSpace: "nowrap" },
  td:          { padding: "14px 16px", borderBottom: "1px solid #f9fafb", verticalAlign: "middle" },
  row:         { cursor: "pointer", transition: "background 0.1s" },
  statusBadge: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, textTransform: "capitalize" },
  empty:       { padding: 40, textAlign: "center", color: "#9ca3af" },
};
