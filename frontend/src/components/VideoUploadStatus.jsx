"use client";

export default function VideoUploadStatus({ status, progress, error }) {
  if (!status || status === "idle") return null;

  const states = {
    uploading: (
      <div style={styles.wrap}>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${progress}%` }} />
        </div>
        <span style={styles.label}>Uploading… {progress}%</span>
      </div>
    ),
    success: <p style={{ ...styles.label, color: "#16a34a" }}>✓ Response saved successfully</p>,
    error:   <p style={{ ...styles.label, color: "#dc2626" }}>✗ {error || "Upload failed. Please retry."}</p>,
  };

  return states[status] ?? null;
}

const styles = {
  wrap:     { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  barTrack: { height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  barFill:  { height: "100%", background: "#2563eb", borderRadius: 4, transition: "width 0.2s" },
  label:    { fontSize: 13, color: "#6b7280" },
};
