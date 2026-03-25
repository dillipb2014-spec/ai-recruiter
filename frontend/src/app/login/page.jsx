"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

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
    <main style={s.bg}>
      <div style={s.card}>
        <div style={s.brand}>
          <span style={s.logo}>GeniusHire</span>
          <span style={s.logoAi}>AI</span>
        </div>
        <p style={s.sub}>Recruiter Portal</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={s.label}>Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={s.input} placeholder="recruiter@company.com"
            />
          </div>
          <div>
            <label style={s.label}>Password</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={s.input} placeholder="••••••••"
            />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <p style={s.applyLink}>
          Not a recruiter?{" "}
          <a href="/apply" style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>
            Apply for a position
          </a>
        </p>
      </div>
    </main>
  );
}

const s = {
  bg:        { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" },
  card:      { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" },
  brand:     { display: "flex", alignItems: "center", gap: 4, marginBottom: 4 },
  logo:      { fontSize: 20, fontWeight: 700, color: "#111827" },
  logoAi:    { fontSize: 20, fontWeight: 700, color: "#0052cc" },
  sub:       { margin: "0 0 28px", fontSize: 13, color: "#6b7280" },
  label:     { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input:     { width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, color: "#111827", outline: "none", boxSizing: "border-box" },
  btn:       { padding: "11px", background: "#0052cc", color: "#fff", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  error:     { margin: 0, fontSize: 12, color: "#dc2626", background: "#fee2e2", padding: "8px 12px", borderRadius: 6 },
  applyLink: { margin: "20px 0 0", fontSize: 13, color: "#6b7280", textAlign: "center" },
};
