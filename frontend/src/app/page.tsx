"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <main style={s.bg}>
      <svg style={s.grain} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" opacity="0.04" />
      </svg>

      <div style={{ ...s.card, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}>
        <div style={s.brand}>
          <span style={s.brandName}>JUSPAY</span>
          <span style={s.brandAi}>AI</span>
        </div>

        <div style={s.divider} />

        <h1 style={s.title}>AI-Powered Recruitment</h1>
        <p style={s.tagline}>Intelligent candidate screening and evaluation</p>

        <div style={s.buttonContainer}>
          <Link href="/apply" style={s.btnPrimary}>
            Apply for Jobs
          </Link>
          <Link href="/dashboard" style={s.btnSecondary}>
            Recruiter Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

const s = {
  bg: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse at 60% 40%, #eef4ff 0%, #f8fafc 50%, #ffffff 100%)",
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  grain: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.5)",
    borderRadius: 20,
    padding: "48px",
    maxWidth: 480,
    width: "90%",
    textAlign: "center",
    boxShadow: "0 32px 64px rgba(0,0,0,0.06)",
    transition: "opacity 0.6s ease, transform 0.6s ease",
  },
  brand: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 12 },
  brandName: { fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "0.12em" },
  brandAi:   { fontSize: 13, fontWeight: 700, color: "#0052cc", letterSpacing: "0.12em" },
  divider:   { width: 32, height: 2, background: "linear-gradient(90deg, #0052cc, #60a5fa)", borderRadius: 999, margin: "0 auto 20px" },
  title:     { margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" },
  tagline:   { margin: "0 0 32px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 },
  buttonContainer: { display: "flex", flexDirection: "column", gap: 16 },
  btnPrimary: {
    display: "block",
    background: "#0052cc",
    color: "#fff",
    padding: "18px 24px",
    borderRadius: 12,
    border: "none",
    fontWeight: 600,
    fontSize: 16,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 4px 14px rgba(0,82,204,0.25)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  btnSecondary: {
    display: "block",
    background: "#fff",
    color: "#0052cc",
    padding: "18px 24px",
    borderRadius: 12,
    border: "2px solid #0052cc",
    fontWeight: 600,
    fontSize: 16,
    cursor: "pointer",
    textDecoration: "none",
    transition: "transform 0.2s ease, background 0.2s ease",
  },
};
// Force sync env vars