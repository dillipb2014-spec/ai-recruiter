"use client";
import { useState } from "react";

const SKILL_OPTIONS = [
  "React", "Node.js", "Python", "AWS", "TypeScript", "Java", "Go",
  "PostgreSQL", "Docker", "Kubernetes", "GraphQL", "Next.js", "MongoDB",
];
const PROFICIENCY   = ["Junior", "Mid", "Senior"];
const EXP_BUCKETS   = ["0-2", "3-5", "5-8", "10+"];
const NOTICE_OPTS   = ["Immediate", "15 days", "30 days", "60+ days"];
const TIMELINE_OPTS = [
  { value: "24h",   label: "Last 24 hours" },
  { value: "week",  label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];
const STATUSES = ["applied", "screening", "screen_select", "screen_reject", "interview", "evaluated", "hired", "rejected"];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={s.section}>
      <button onClick={() => setOpen((o) => !o)} style={s.sectionHead}>
        <span style={s.sectionTitle}>{title}</span>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={s.sectionBody}>{children}</div>}
    </div>
  );
}

function TagButton({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...s.tag, ...(active ? s.tagActive : {}) }}>
      {label}
    </button>
  );
}

export default function FilterSidebar({ filters, set, toggle, reset, saved: savedSearches, saveLabel, setSaveLabel, saveSearch, loadSearch, deleteSaved }) {
  const [skillInput, setSkillInput] = useState("");

  const addCustomSkill = () => {
    const v = skillInput.trim();
    if (v && !filters.skills.includes(v)) toggle("skills", v);
    setSkillInput("");
  };

  return (
    <aside style={s.sidebar}>
      <div style={s.sidebarHead}>
        <span style={s.sidebarTitle}>🔍 Filters</span>
        <button onClick={reset} style={s.resetBtn}>Reset all</button>
      </div>

      {/* Messages Nav */}
      <a href="/messages" style={s.navLink}>
        <span style={{ fontSize: 15 }}>💬</span> SMS Inbox
        <span style={s.navBadge}>CRM</span>
      </a>

      {/* Genius Match */}
      <div style={s.geniusRow}>
        <label style={s.geniusLabel}>
          <input type="checkbox" checked={filters.geniusMatch}
            onChange={(e) => set("geniusMatch", e.target.checked)} style={{ marginRight: 6 }} />
          ⚡ Genius Match <span style={s.geniusHint}>(Score &gt; 85)</span>
        </label>
      </div>

      {/* AI Match Score */}
      <Section title="AI Match Score">
        <div style={s.rangeRow}>
          <span style={s.rangeVal}>{filters.scoreMin}</span>
          <div style={s.rangeTrack}>
            <input type="range" min={0} max={100} value={filters.scoreMin}
              onChange={(e) => set("scoreMin", Math.min(+e.target.value, filters.scoreMax - 1))}
              style={s.range} disabled={filters.geniusMatch} />
            <input type="range" min={0} max={100} value={filters.scoreMax}
              onChange={(e) => set("scoreMax", Math.max(+e.target.value, filters.scoreMin + 1))}
              style={s.range} disabled={filters.geniusMatch} />
          </div>
          <span style={s.rangeVal}>{filters.scoreMax}</span>
        </div>
        {filters.geniusMatch && <p style={s.hint}>Overridden by Genius Match (85–100)</p>}
      </Section>

      {/* Status Pipeline */}
      <Section title="Status Pipeline">
        <div style={s.tagWrap}>
          {STATUSES.map((st) => (
            <TagButton key={st} label={st.replace("_", " ")}
              active={filters.status.includes(st)} onClick={() => toggle("status", st)} />
          ))}
        </div>
      </Section>

      {/* Technical Skills */}
      <Section title="Technical Skills">
        <div style={s.tagWrap}>
          {SKILL_OPTIONS.map((sk) => (
            <TagButton key={sk} label={sk}
              active={filters.skills.includes(sk)} onClick={() => toggle("skills", sk)} />
          ))}
        </div>
        <div style={s.skillInputRow}>
          <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
            placeholder="Add skill…" style={s.skillInput} />
          <button onClick={addCustomSkill} style={s.addBtn}>+</button>
        </div>
        {filters.skills.filter((s) => !SKILL_OPTIONS.includes(s)).map((sk) => (
          <TagButton key={sk} label={`✕ ${sk}`} active onClick={() => toggle("skills", sk)} />
        ))}
      </Section>

      {/* Skill Proficiency */}
      <Section title="Skill Proficiency" defaultOpen={false}>
        <div style={s.tagWrap}>
          {PROFICIENCY.map((p) => (
            <TagButton key={p} label={p}
              active={filters.proficiency.includes(p)} onClick={() => toggle("proficiency", p)} />
          ))}
        </div>
      </Section>

      {/* Experience */}
      <Section title="Years of Experience" defaultOpen={false}>
        <div style={s.tagWrap}>
          {EXP_BUCKETS.map((b) => (
            <TagButton key={b} label={`${b} yrs`}
              active={filters.expBucket.includes(b)} onClick={() => toggle("expBucket", b)} />
          ))}
        </div>
      </Section>

      {/* Source */}
      <Section title="Application Source" defaultOpen={false}>
        <div style={s.tagWrap}>
          <TagButton label="Individual" active={filters.source.includes("individual")} onClick={() => toggle("source", "individual")} />
          <TagButton label="Bulk Upload" active={filters.source.includes("bulk")}       onClick={() => toggle("source", "bulk")} />
        </div>
      </Section>

      {/* Timeline */}
      <Section title="Applied Date" defaultOpen={false}>
        <div style={s.tagWrap}>
          {TIMELINE_OPTS.map((t) => (
            <TagButton key={t.value} label={t.label}
              active={filters.timeline === t.value}
              onClick={() => set("timeline", filters.timeline === t.value ? "" : t.value)} />
          ))}
        </div>
      </Section>

      {/* Notice Period */}
      <Section title="Notice Period" defaultOpen={false}>
        <div style={s.tagWrap}>
          {NOTICE_OPTS.map((n) => (
            <TagButton key={n} label={n}
              active={filters.noticePeriod.includes(n)} onClick={() => toggle("noticePeriod", n)} />
          ))}
        </div>
      </Section>

      {/* Save Search */}
      <Section title="💾 Save Search" defaultOpen={false}>
        <div style={s.saveRow}>
          <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveSearch()}
            placeholder="e.g. Top React Seniors" style={s.skillInput} />
          <button onClick={saveSearch} style={s.addBtn}>Save</button>
        </div>
        {savedSearches.map((sv) => (
          <div key={sv.id} style={s.savedItem}>
            <button onClick={() => loadSearch(sv)} style={s.savedLabel}>{sv.label}</button>
            <button onClick={() => deleteSaved(sv.id)} style={s.deleteBtn}>✕</button>
          </div>
        ))}
      </Section>
    </aside>
  );
}

const s = {
  sidebar:      { width: 240, minWidth: 240, background: "#fff", borderRight: "1px solid #e5e7eb", overflowY: "auto", height: "100vh", position: "sticky", top: 0, padding: "16px 0", boxSizing: "border-box", flexShrink: 0 },
  sidebarHead:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px 12px", borderBottom: "1px solid #f3f4f6" },
  sidebarTitle: { fontWeight: 700, fontSize: 14, color: "#111827" },
  resetBtn:     { fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" },
  navLink:      { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#4f46e5", textDecoration: "none", borderBottom: "1px solid #f3f4f6", background: "#fafafa" },
  navBadge:     { marginLeft: "auto", fontSize: 10, fontWeight: 700, background: "#eef2ff", color: "#4f46e5", padding: "2px 7px", borderRadius: 999 },
  geniusRow:    { padding: "10px 16px", background: "#fffbeb", borderBottom: "1px solid #fef3c7" },
  geniusLabel:  { display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#92400e", cursor: "pointer" },
  geniusHint:   { fontWeight: 400, color: "#b45309", marginLeft: 4, fontSize: 11 },
  section:      { borderBottom: "1px solid #f3f4f6" },
  sectionHead:  { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" },
  sectionBody:  { padding: "4px 16px 12px" },
  tagWrap:      { display: "flex", flexWrap: "wrap", gap: 5 },
  tag:          { padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, borderWidth: 1, borderStyle: "solid", borderColor: "#e5e7eb", background: "#f9fafb", color: "#374151", cursor: "pointer" },
  tagActive:    { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" },
  rangeRow:     { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
  rangeTrack:   { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  range:        { width: "100%", accentColor: "#2563eb", cursor: "pointer" },
  rangeVal:     { fontSize: 11, color: "#6b7280", minWidth: 22, textAlign: "center" },
  hint:         { margin: "4px 0 0", fontSize: 11, color: "#9ca3af" },
  skillInputRow:{ display: "flex", gap: 4, marginTop: 6 },
  skillInput:   { flex: 1, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, outline: "none" },
  addBtn:       { padding: "5px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 700 },
  saveRow:      { display: "flex", gap: 4, marginBottom: 8 },
  savedItem:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  savedLabel:   { fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, padding: "2px 0" },
  deleteBtn:    { fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" },
};
