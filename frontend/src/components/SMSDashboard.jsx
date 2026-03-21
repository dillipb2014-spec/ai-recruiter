"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TEMPLATES = [
  {
    label: "Interview Invite",
    icon: "📅",
    text: (c) =>
      `Hi ${c.full_name}, great news! Your AI screening was a match for ${c.job_role_title || "the role"}. Are you available for a Tech Round this week?`,
  },
  {
    label: "Salary Discussion",
    icon: "💰",
    text: (c) =>
      `Hi ${c.full_name}, I see your expected CTC is ₹${c.expected_ctc ?? "—"} LPA. Let's discuss this on a quick call — when works for you?`,
  },
  {
    label: "Follow Up",
    icon: "🔔",
    text: (c) =>
      `Hi ${c.full_name}, just checking in — did you receive the screening link? Let us know if you need any help.`,
  },
];

export default function SMSDashboard() {
  const [contacts, setContacts]       = useState([]);
  const [active, setActive]           = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError]             = useState("");
  const bottomRef                     = useRef();

  useEffect(() => {
    fetch(`${API}/api/candidates?status=screen_select`, { credentials: "include" })
      .then((r) => r.json())
      .then(setContacts)
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async (id) => {
    setLoadingMsgs(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/sms/${id}`, { credentials: "include" });
      setMessages(await r.json());
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (active) loadMessages(active.id);
    else setMessages([]);
  }, [active, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !active) return;
    setSending(true);
    setError("");
    const body = input.trim();
    setInput("");

    // Optimistic update
    setMessages((prev) => [...prev, {
      id: `tmp_${Date.now()}`, body, direction: "outbound",
      created_at: new Date().toISOString(),
    }]);

    try {
      const r = await fetch(`${API}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ candidate_id: active.id, body }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Send failed");
      // Reload to get server-confirmed message with real ID
      loadMessages(active.id);
    } catch (e) {
      setError(e.message);
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => !m.id?.startsWith("tmp_")));
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(tpl) {
    setInput(tpl.text(active));
  }

  const score = active
    ? parseFloat(active.overall_score ?? active.resume_score ?? 0)
    : 0;
  const scoreColor = score >= 70 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";

  return (
    <div style={s.shell}>

      {/* ── Pane 1: Contacts ── */}
      <div style={s.contacts}>
        <div style={s.paneHead}>
          <span style={s.paneTitle}>SMS INBOX</span>
          <span style={s.badge}>{contacts.length} pending</span>
        </div>
        {contacts.length === 0 && (
          <p style={s.empty}>No HR Action Pending candidates</p>
        )}
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => setActive(c)}
            style={{ ...s.contactRow, ...(active?.id === c.id ? s.contactRowActive : {}) }}
          >
            <div style={s.avatar}>{c.full_name?.[0]?.toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={s.contactName}>{c.full_name}</div>
              <div style={s.contactSub}>{c.phone || c.email}</div>
            </div>
            <span style={s.indigoDot} />
          </div>
        ))}
      </div>

      {/* ── Pane 2: Chat ── */}
      <div style={s.chat}>
        {!active ? (
          <div style={s.chatEmpty}>
            <p style={{ fontSize: 36, margin: "0 0 12px" }}>💬</p>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Select a candidate to start an SMS conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={s.chatHead}>
              <div style={s.avatar}>{active.full_name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{active.full_name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {active.phone ? `📱 ${active.phone}` : "No phone on record"}
                </div>
              </div>
              <span style={s.smsBadge}>SMS</span>
            </div>

            {/* Message thread */}
            <div style={s.msgList}>
              {loadingMsgs && <p style={s.empty}>Loading messages…</p>}
              {!loadingMsgs && messages.length === 0 && (
                <p style={s.empty}>No messages yet — use a template below to start.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  {m.direction === "inbound" && (
                    <div style={{ ...s.avatar, width: 26, height: 26, fontSize: 11, marginRight: 6, alignSelf: "flex-end", flexShrink: 0 }}>
                      {active.full_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ ...s.bubble, ...(m.direction === "outbound" ? s.bubbleOut : s.bubbleIn) }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{m.body}</p>
                    <span style={s.bubbleTime}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {m.direction === "outbound" && <span style={{ marginLeft: 4 }}>✓</span>}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Smart Templates */}
            <div style={s.templates}>
              <span style={s.templatesLabel}>Templates:</span>
              {TEMPLATES.map((tpl) => (
                <button key={tpl.label} onClick={() => applyTemplate(tpl)} style={s.tplBtn}>
                  {tpl.icon} {tpl.label}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && <p style={s.errorText}>⚠ {error}</p>}

            {/* Input */}
            <div style={s.inputRow}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type an SMS… (Enter to send, Shift+Enter for new line)"
                rows={2}
                style={s.textarea}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{ ...s.sendBtn, opacity: sending || !input.trim() ? 0.5 : 1 }}
              >
                {sending ? "Sending…" : "Send SMS"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Pane 3: Candidate Profile ── */}
      <div style={s.profile}>
        <div style={s.paneHead}>
          <span style={s.paneTitle}>CANDIDATE</span>
        </div>
        {!active ? (
          <p style={s.empty}>No candidate selected</p>
        ) : (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={s.avatar}>{active.full_name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{active.full_name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{active.email}</div>
              </div>
            </div>

            <span style={s.hrBadge}>Screen Select</span>

            <div style={s.profileRow}>
              <span style={s.profileLabel}>SCORE</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>
                {score > 0 ? `${score}%` : "—"}
              </span>
            </div>
            {active.job_role_title && (
              <div style={s.profileRow}>
                <span style={s.profileLabel}>ROLE</span>
                <span style={s.profileVal}>{active.job_role_title}</span>
              </div>
            )}
            {active.current_company && (
              <div style={s.profileRow}>
                <span style={s.profileLabel}>COMPANY</span>
                <span style={s.profileVal}>{active.current_company}</span>
              </div>
            )}
            {active.expected_ctc && (
              <div style={s.profileRow}>
                <span style={s.profileLabel}>EXPECTED CTC</span>
                <span style={s.profileVal}>₹{active.expected_ctc} LPA</span>
              </div>
            )}
            {active.experience_years != null && (
              <div style={s.profileRow}>
                <span style={s.profileLabel}>EXPERIENCE</span>
                <span style={s.profileVal}>{active.experience_years} yrs</span>
              </div>
            )}
            {active.notice_period && (
              <div style={s.profileRow}>
                <span style={s.profileLabel}>NOTICE</span>
                <span style={s.profileVal}>{active.notice_period}</span>
              </div>
            )}
            {active.ai_decision_insight && (
              <div style={s.insightCard}>
                <p style={s.insightLabel}>✦ AI INSIGHT</p>
                <p style={s.insightText}>{active.ai_decision_insight}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  shell:            { display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "system-ui,-apple-system,sans-serif", overflow: "hidden" },
  contacts:         { width: 256, minWidth: 256, background: "#fff", borderRight: "1px solid #e5e7eb", overflowY: "auto", flexShrink: 0 },
  chat:             { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#f9fafb" },
  profile:          { width: 256, minWidth: 256, background: "#fff", borderLeft: "1px solid #e5e7eb", overflowY: "auto", flexShrink: 0 },
  paneHead:         { padding: "14px 16px 12px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" },
  paneTitle:        { fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em" },
  badge:            { fontSize: 11, fontWeight: 600, color: "#4f46e5", background: "#eef2ff", padding: "2px 8px", borderRadius: 999 },
  contactRow:       { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f9fafb" },
  contactRowActive: { background: "#eef2ff" },
  contactName:      { fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  contactSub:       { fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  avatar:           { width: 34, height: 34, borderRadius: "50%", background: "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 },
  indigoDot:        { width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", flexShrink: 0 },
  chatHead:         { display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff" },
  smsBadge:         { marginLeft: "auto", padding: "4px 12px", background: "#eef2ff", color: "#4f46e5", borderRadius: 999, fontSize: 11, fontWeight: 700 },
  msgList:          { flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column" },
  bubble:           { maxWidth: "68%", padding: "9px 13px", borderRadius: 14 },
  bubbleOut:        { background: "#4f46e5", color: "#fff", borderBottomRightRadius: 3 },
  bubbleIn:         { background: "#fff", color: "#111827", borderBottomLeftRadius: 3, border: "1px solid #e5e7eb" },
  bubbleTime:       { display: "block", fontSize: 10, marginTop: 4, opacity: 0.65, textAlign: "right" },
  templates:        { display: "flex", gap: 6, padding: "8px 16px", borderTop: "1px solid #e5e7eb", flexWrap: "wrap", alignItems: "center", background: "#fff" },
  templatesLabel:   { fontSize: 11, fontWeight: 600, color: "#9ca3af" },
  tplBtn:           { padding: "5px 12px", background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  inputRow:         { display: "flex", gap: 8, padding: "10px 16px", borderTop: "1px solid #e5e7eb", background: "#fff", alignItems: "flex-end" },
  textarea:         { flex: 1, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 },
  sendBtn:          { padding: "9px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  chatEmpty:        { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  empty:            { textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "20px 16px" },
  errorText:        { margin: "0 16px 4px", fontSize: 12, color: "#dc2626" },
  hrBadge:          { display: "inline-block", marginBottom: 12, padding: "3px 10px", background: "#eef2ff", color: "#4f46e5", borderRadius: 999, fontSize: 11, fontWeight: 600 },
  profileRow:       { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: "1px solid #f3f4f6", paddingBottom: 8 },
  profileLabel:     { fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" },
  profileVal:       { fontSize: 13, color: "#111827", fontWeight: 500, textAlign: "right", maxWidth: "60%" },
  insightCard:      { marginTop: 12, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "10px 12px" },
  insightLabel:     { margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em", textTransform: "uppercase" },
  insightText:      { margin: 0, fontSize: 12, color: "#312e81", lineHeight: 1.55 },
};
