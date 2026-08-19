// Shows both figures side by side, deliberately labeled differently, per
// the specification document's guidance not to call a partial metric "OEE"
// when it hasn't been confirmed to capture all three loss factors.
export default function OEEWidget({ metrics }) {
  if (!metrics) return <p className="muted">No production data logged yet for this machine.</p>;

  const pct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="grid cols-2">
      <div className="card metric">
        <div className="value">{pct(metrics.performanceRate)}</div>
        <div className="label">Performance Rate (your formula)</div>
      </div>
      <div className="card metric">
        <div className="value">{pct(metrics.oee)}</div>
        <div className="label">Full OEE (Availability × Performance × Quality)</div>
      </div>
      <div className="card metric">
        <div className="value">{pct(metrics.availability)}</div>
        <div className="label">Availability</div>
      </div>
      <div className="card metric">
        <div className="value">{pct(metrics.quality)}</div>
        <div className="label">Quality</div>
      </div>
    </div>
  );
}
