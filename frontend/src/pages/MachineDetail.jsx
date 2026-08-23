import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import client from "../api/client";
import StatusBadge from "../components/StatusBadge";
import OEEWidget from "../components/OEEWidget";

export default function MachineDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [failureTypes, setFailureTypes] = useState([]);
  const [oeeLogs, setOeeLogs] = useState([]);
  const [form, setForm] = useState({
    componentId: "",
    failureType: "",
    severity: 5,
    description: "",
    downtimeMinutes: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");

  async function loadAll() {
    try {
      const [detailRes, typesRes, oeeRes] = await Promise.all([
        client.get(`/machines/${id}/detail`),
        client.get("/failure-types"),
        client.get(`/production-logs/machine/${id}`),
      ]);
      setDetail(detailRes.data);
      setFailureTypes(typesRes.data);
      setOeeLogs(oeeRes.data);
    } catch (err) {
      setLoadError("Failed to load machine data.");
    }
  }

  useEffect(() => { loadAll(); }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      // Bug fix: lineId may be a populated object or a plain string on the
      // machine document — resolve to the raw ID string before sending.
      const rawLine = detail.machine.lineId;
      const lineId = typeof rawLine === "object" ? rawLine._id : rawLine;

      const { data } = await client.post("/breakdowns", {
        lineId,
        machineId: id,
        ...form,
      });
      setResult(data.criticalAlert ? "critical" : "logged");
      setForm({ componentId: "", failureType: "", severity: 5, description: "", downtimeMinutes: 0 });
      loadAll();
    } catch (err) {
      setResult("error:" + (err.response?.data?.error || "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="content">
        <div className="card">
          <p className="error-text">{loadError}</p>
          <button className="btn secondary" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return <div className="content"><div className="card loading-card">Loading machine…</div></div>;
  }

  const { machine, components, recentReports } = detail;
  const latestOee = oeeLogs[0]?.metrics;

  // Captains should only see their own machine - but we don't hard-block
  // navigation here; the backend access controls handle that.

  return (
    <div className="content">
      <button
        className="btn secondary"
        style={{ marginBottom: 12 }}
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{machine.name}</h2>
        <p className="muted">
          {machine.lineId?.name || ""} · Criticality: {machine.criticality}
        </p>
      </div>

      {/* OEE */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Machine OEE</h3>
        <OEEWidget metrics={latestOee} />
      </div>

      {/* Component status */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Component Status</h3>
        <table>
          <thead>
            <tr><th>Component</th><th>Status</th></tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td><StatusBadge status={c.currentStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakdown report form */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Report a Breakdown</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Component *</label>
            <select
              value={form.componentId}
              onChange={(e) => setForm({ ...form, componentId: e.target.value })}
              required
            >
              <option value="">Select component…</option>
              {components.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Failure Type *</label>
            <select
              value={form.failureType}
              onChange={(e) => setForm({ ...form, failureType: e.target.value })}
              required
            >
              <option value="">Select failure type…</option>
              {failureTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid cols-2">
            <div className="form-row">
              <label>Severity (1 = minor, 10 = critical) *</label>
              <input
                type="number" min="1" max="10"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                required
              />
            </div>
            <div className="form-row">
              <label>Downtime so far (minutes)</label>
              <input
                type="number" min="0"
                value={form.downtimeMinutes}
                onChange={(e) => setForm({ ...form, downtimeMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-row">
            <label>Notes (optional)</label>
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <button className="btn accent" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </form>

        {result === "critical" && (
          <div className="alert-banner critical" style={{ marginTop: 12 }}>
            ⚠️ This component has reached its critical-alert threshold. An Engineer has been notified.
          </div>
        )}
        {result === "logged" && (
          <div className="alert-banner success" style={{ marginTop: 12 }}>
            ✓ Report submitted successfully.
          </div>
        )}
        {typeof result === "string" && result.startsWith("error:") && (
          <p className="error-text" style={{ marginTop: 8 }}>
            {result.replace("error:", "")}
          </p>
        )}
      </div>

      {/* Recent reports */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent Reports on This Machine</h3>
        {recentReports.length === 0 ? (
          <p className="muted">No reports yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Failure Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((r) => (
                <tr key={r._id}>
                  <td>{r.componentId?.name || "—"}</td>
                  <td>{r.failureType}</td>
                  <td>{r.severity}</td>
                  <td>{r.status}</td>
                  <td className="muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
