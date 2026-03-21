"use client";
import { use, useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function ScreeningTestPage({ params }) {
  const { id } = use(params);

  const [stage, setStage]       = useState("loading"); // loading | test | submitting | done | error
  const [jobTitle, setJobTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent]   = useState(0);
  const [answers, setAnswers]   = useState([]);
  const [draft, setDraft]       = useState("");
  const [result, setResult]     = useState(null);
  const [errMsg, setErrMsg]     = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/screening-test/${id}/questions`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error || d.detail) throw new Error(d.error || d.detail);
        setJobTitle(d.job_title);
        setQuestions(d.questions);
        setAnswers(new Array(d.questions.length).fill(""));
        setStage("test");
      })
      .catch((e) => { setErrMsg(e.message); setStage("error"); });
  }, [id]);

  function handleNext() {
    const updated = [...answers];
    updated[current] = draft;
    setAnswers(updated);
    setDraft(updated[current + 1] || "");
    setCurrent((c) => c + 1);
  }

  function handleBack() {
    const updated = [...answers];
    updated[current] = draft;
    setAnswers(updated);
    setDraft(updated[current - 1] || "");
    setCurrent((c) => c - 1);
  }

  async function handleSubmit() {
    const updated = [...answers];
    updated[current] = draft;
    setAnswers(updated);
    setStage("submitting");

    const payload = questions.map((q, i) => ({ question: q, answer: updated[i] || "" }));

    try {
      const res = await fetch(`${BASE}/api/screening-test/${id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Evaluation failed");
      setResult(data);
      setStage("done");
    } catch (e) {
      setErrMsg(e.message);
      setStage("error");
    }
  }

  if (stage === "loading") return <Shell><p style={s.hint}>Loading your screening test…</p></Shell>;
  if (stage === "error")   return <Shell><p style={{ color: "#dc2626", fontSize: 14 }}>⚠ {errMsg}</p></Shell>;

  if (stage === "done") {
    return (
      <Shell>
        <div style={s.resultCard}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Thank you!
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
            Thank you for completing the screening test! Your responses have been submitted and are under review. Our team will contact you if your profile matches our requirements.
          </p>
          <button
            onClick={() => window.location.href = "https://juspay.in"}
            style={{ padding: "12px 24px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}
          >
            Go to Juspay Home
          </button>
        </div>
      </Shell>
    );
  }

  const isLast = current === questions.length - 1;
  const progress = Math.round(((current + 1) / questions.length) * 100);

  return (
    <Shell>
      <div style={s.header}>
        <p style={s.roleLabel}>{jobTitle}</p>
        <h1 style={s.title}>Screening Test</h1>
        <p style={s.hint}>Answer each question honestly. There are no trick questions.</p>
      </div>

      {/* Progress bar */}
      <div style={s.progressWrap}>
        <div style={{ ...s.progressBar, width: `${progress}%` }} />
      </div>
      <p style={s.progressLabel}>Question {current + 1} of {questions.length}</p>

      {/* Question card */}
      <div style={s.card}>
        <p style={s.questionText}>{questions[current]}</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your answer here…"
          style={s.textarea}
          rows={5}
          disabled={stage === "submitting"}
        />
      </div>

      {/* Navigation */}
      <div style={s.navRow}>
        {current > 0 && (
          <button onClick={handleBack} style={s.btnSecondary}>← Back</button>
        )}
        <div style={{ flex: 1 }} />
        {!isLast ? (
          <button onClick={handleNext} disabled={!draft.trim()} style={s.btnPrimary}>
            Next →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!draft.trim() || stage === "submitting"} style={s.btnSuccess}>
            {stage === "submitting" ? "Submitting…" : "Submit Test ✓"}
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={s.shell}>
      <div style={s.container}>
        <p style={s.brand}>JUSPAY <span style={{ color: "#0052cc" }}>AI</span></p>
        {children}
      </div>
    </div>
  );
}

const s = {
  shell:        { minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 16px" },
  container:    { width: "100%", maxWidth: 600 },
  brand:        { margin: "0 0 32px", fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" },
  header:       { marginBottom: 24 },
  roleLabel:    { margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#0052cc", textTransform: "uppercase", letterSpacing: "0.08em" },
  title:        { margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#111827" },
  hint:         { margin: 0, fontSize: 13, color: "#6b7280" },
  progressWrap: { height: 4, background: "#e5e7eb", borderRadius: 999, marginBottom: 6, overflow: "hidden" },
  progressBar:  { height: "100%", background: "#0052cc", borderRadius: 999, transition: "width 0.3s ease" },
  progressLabel:{ margin: "0 0 20px", fontSize: 12, color: "#9ca3af" },
  card:         { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 16 },
  questionText: { margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.6 },
  textarea:     { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#374151", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 },
  navRow:       { display: "flex", alignItems: "center", gap: 10 },
  btnPrimary:   { padding: "10px 24px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnSuccess:   { padding: "10px 24px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnSecondary: { padding: "10px 18px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  resultCard:   { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "32px 28px", textAlign: "center" },
};
