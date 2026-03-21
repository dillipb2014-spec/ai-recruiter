"use client";
import { useRef, useState } from "react";

const ACCEPTED = [".pdf", ".doc", ".docx"];

export default function ResumeUpload({ file, onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(f) {
    if (!f) return;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      alert("Only PDF, DOC, or DOCX files are allowed.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      alert("File must be under 5MB.");
      return;
    }
    onChange(f);
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? "#2563eb" : file ? "#16a34a" : "#d1d5db"}`,
        borderRadius: 8, padding: "24px 16px", textAlign: "center",
        cursor: "pointer", background: dragging ? "#eff6ff" : file ? "#f0fdf4" : "#f9fafb",
        transition: "all 0.2s",
      }}
    >
      <input
        ref={inputRef} type="file" accept={ACCEPTED.join(",")}
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {file ? (
        <p style={{ margin: 0, fontSize: 14, color: "#16a34a", fontWeight: 500 }}>
          ✓ {file.name} ({(file.size / 1024).toFixed(0)} KB)
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "#374151", fontWeight: 500 }}>
            Drop your resume here or click to browse
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>PDF, DOC, DOCX — max 5MB</p>
        </>
      )}
    </div>
  );
}
