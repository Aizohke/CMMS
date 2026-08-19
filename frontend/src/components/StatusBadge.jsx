export default function StatusBadge({ status }) {
  const cls = status === "Critical" ? "critical" : status === "Acknowledged" ? "acknowledged" : "normal";
  return <span className={`badge ${cls}`}>{status}</span>;
}
