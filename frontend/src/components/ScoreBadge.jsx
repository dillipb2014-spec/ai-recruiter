export default function ScoreBadge({ score, size = "md" }) {
  if (score == null) return <span style={styles.na}>N/A</span>;

  const val = parseFloat(score);
  const color = val >= 75 ? "#16a34a" : val >= 50 ? "#d97706" : "#dc2626";
  const bg    = val >= 75 ? "#dcfce7" : val >= 50 ? "#fef3c7" : "#fee2e2";

  return (
    <span style={{
      ...styles.badge,
      color, background: bg,
      fontSize: size === "lg" ? 18 : 12,
      padding:  size === "lg" ? "6px 14px" : "2px 8px",
    }}>
      {val.toFixed(1)}
    </span>
  );
}

const styles = {
  badge: { borderRadius: 999, fontWeight: 700, display: "inline-block" },
  na:    { fontSize: 12, color: "#9ca3af" },
};
