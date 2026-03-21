"use client";

export default function FormField({ label, error, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
        {label} {props.required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <input
        {...props}
        style={{
          padding: "10px 12px",
          border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
          borderRadius: 8,
          fontSize: 14,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
      {error && <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}
