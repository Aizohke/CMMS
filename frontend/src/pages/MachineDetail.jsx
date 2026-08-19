import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import StatusBadge from "../components/StatusBadge";
import OEEWidget from "../components/OEEWidget";

// Section 12.1: machine detail screen - status, open reports, structured
// breakdown reporting form, and OEE. FMEA/Pareto charts are a Phase 5
// roadmap item (data model already supports them; charting UI is not yet
// built - see the specification document).
export default function MachineDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [failureTypes, setFailureTypes] = useState([]);
  const [oeeLogs, setOeeLogs] = useState([]);
  const [form, setForm] = useState({ componentId: "", failureType: "", severity: 5, description: "", downtimeMinutes: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function loadAll() {
    const [detailRes, typesRes, oeeRes] = await Promise.all([
      client.get(`/machines/${id}/detail`),
      client.get("/failure-types"),
      client.get(`/production-logs/machine/${id}`),
    ]);
    setDetail(detailRes.data);
    setFailureTypes(typesRes.data);
    setOeeLogs(oeeRes.data);
  }

  useEffect(() => { loadAll(); }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const { data } = await client.post("/breakdowns", {
        lineId: detail.machine.lineId._id,
        machineId: id,
        ...form,
      });
      setResult(data.criticalAlert ? "critical" : "logged");
      setForm({ componentId: "", failureType: "", severity: 5, description: "", downtimeMinutes: 0 });
      loadAll();
    } catch (err) {
      setResult("error:" + (err.response?.data?.error || "submission failed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!detail) return <div className="content">Loading...</div>;

  const { machine, components, recentReports } = detail;
  const latestOee = oeeLogs[0]?.metrics;

  return (
    <div className="content">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{machine.name}</h2>
        <p className="muted">{machine.lineId?.name} · Criticality: {machine.criticality}</p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Machine OEE</h3>
        <OEEWidget metrics={latestOee} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Report a Breakdown</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Component</label>
            <select value={form.componentId} onChange={(e) => setForm({ ...form, componentId: e.target.value })} required>
              <option value="">Select component...</option>
              {components.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Failure Type</label>
            <select value={form.failureType} onChange={(e) => setForm({ ...form, failureType: e.target.value })} required>
              <option value="">Select failure type...</option>
              {failureTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Severity (1-10)</label>
            <input type="number" min="1" max="10" value={form.severity}
              onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })} required />
          </div>
          <div className="form-row">
            <label>Downtime so far (minutes)</label>
            <input type="number" min="0" value={form.downtimeMinutes}
              onChange={(e) => setForm({ ...form, downtimeMinutes: Number(e.target.value) })} />
          </div>
          <div className="form-row">
            <label>Notes (optional)</label>
            <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn accent" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
        {result === "critical" && (
          <p style={{ color: "var(--color-critical)", fontWeight: 700, marginTop: 10 }}>
            This component has now reached its critical-alert threshold. An Engineer has been notified.
          </p>
        )}
        {result === "logged" && <p style={{ color: "var(--color-normal)", marginTop: 10 }}>Report submitted.</p>}
        {typeof result === "string" && result.startsWith("error:") && (
          <p className="error-text">{result.replace("error:", "")}</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Component Status</h3>
        <table>
          <thead><tr><th>Component</th><th>Status</th></tr></thead>
          <tbody>
            {components.map((c) => (
              <tr key={c._id}><td>{c.name}</td><td><StatusBadge status={c.currentStatus} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent Reports on This Machine</h3>
        <table>
          <thead><tr><th>Component</th><th>Failure Type</th><th>Status</th></tr></thead>
          <tbody>
            {recentReports.map((r) => (
              <tr key={r._id}>
                <td>{r.componentId?.name}</td>
                <td>{r.failureType}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
