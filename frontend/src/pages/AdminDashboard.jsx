import { useEffect, useState } from "react";
import client from "../api/client";
import StatusBadge from "../components/StatusBadge";

const TABS = ["Critical Alerts", "Breakdown Log", "OEE Overview"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("Critical Alerts");
  return (
    <div className="content">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} className={`btn ${tab === t ? "" : "secondary"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Critical Alerts" && <CriticalAlertsTab />}
      {tab === "Breakdown Log" && <BreakdownLogTab />}
      {tab === "OEE Overview" && <OEEOverviewTab />}
    </div>
  );
}

// Master Guideline Section 12.3: the one screen a manager should check
// every morning - every Critical/Acknowledged component, oldest first.
function CriticalAlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [resolving, setResolving] = useState(null);
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [formError, setFormError] = useState("");

  async function load() {
    const { data } = await client.get("/alerts");
    setAlerts(data);
  }
  useEffect(() => { load(); }, []);

  async function acknowledge(id) {
    await client.patch(`/alerts/${id}/acknowledge`);
    load();
  }

  async function submitResolve(id) {
    setFormError("");
    if (!rootCause.trim() || !correctiveAction.trim()) {
      setFormError("Root cause and corrective action are both required.");
      return;
    }
    await client.patch(`/alerts/${id}/resolve`, { rootCause, correctiveAction });
    setResolving(null);
    setRootCause("");
    setCorrectiveAction("");
    load();
  }

  const hoursOutstanding = (triggeredAt) => Math.round((Date.now() - new Date(triggeredAt)) / 3600000);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Plant-Wide Critical Alerts</h3>
      {alerts.length === 0 && <p className="muted">No active critical alerts.</p>}
      {alerts.map((a) => (
        <div key={a._id} className="card" style={{ borderLeft: `4px solid var(--color-${a.status.toLowerCase()})` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{a.componentId?.name}</strong> — {a.machineId?.name} ({a.lineId?.name})
              <div className="muted">
                {a.failureCount} failures in {a.windowDays} days · outstanding {hoursOutstanding(a.triggeredAt)}h
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>

          {a.status === "Critical" && (
            <button className="btn" style={{ marginTop: 10 }} onClick={() => acknowledge(a._id)}>
              Acknowledge
            </button>
          )}

          {a.status === "Acknowledged" && resolving !== a._id && (
            <button className="btn accent" style={{ marginTop: 10 }} onClick={() => setResolving(a._id)}>
              Resolve (requires root cause)
            </button>
          )}

          {resolving === a._id && (
            <div style={{ marginTop: 10 }}>
              <div className="form-row">
                <label>Root Cause</label>
                <textarea rows="2" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Corrective Action Taken</label>
                <textarea rows="2" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
              </div>
              {formError && <p className="error-text">{formError}</p>}
              <button className="btn accent" onClick={() => submitResolve(a._id)}>Confirm Resolve</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Live breakdown table with a client-side "Download as Excel" (CSV) export -
// the database stays authoritative; this is always a fresh export, never a
// hand-edited file (Master Guideline Section 13).
function BreakdownLogTab() {
  const [reports, setReports] = useState([]);

  async function load() {
    const { data } = await client.get("/breakdowns");
    setReports(data);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id) {
    await client.patch(`/breakdowns/${id}/resolve`);
    load();
  }

  function downloadCsv() {
    const headers = ["Line", "Machine", "Component", "Failure Type", "Severity", "Status", "Reported By", "Date"];
    const rows = reports.map((r) => [
      r.lineId?.name, r.machineId?.name, r.componentId?.name, r.failureType,
      r.severity, r.status, r.reportedBy?.name, new Date(r.createdAt).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breakdown-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ marginTop: 0 }}>Breakdown Log</h3>
        <button className="btn secondary" onClick={downloadCsv}>Download as Excel (CSV)</button>
      </div>
      <table>
        <thead>
          <tr><th>Machine</th><th>Component</th><th>Failure Type</th><th>Sev.</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r._id}>
              <td>{r.machineId?.name}</td>
              <td>{r.componentId?.name}</td>
              <td>{r.failureType}</td>
              <td>{r.severity}</td>
              <td>{r.status}</td>
              <td>
                {r.status !== "Resolved" && (
                  <button className="btn secondary" onClick={() => resolve(r._id)}>Mark Resolved</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OEEOverviewTab() {
  const [overview, setOverview] = useState([]);
  useEffect(() => {
    client.get("/production-logs/overview").then(({ data }) => setOverview(data));
  }, []);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Plant-Wide OEE Overview</h3>
      <table>
        <thead>
          <tr><th>Machine</th><th>Line</th><th>Performance Rate</th><th>Full OEE</th></tr>
        </thead>
        <tbody>
          {overview.map(({ machine, latestMetrics }) => (
            <tr key={machine._id}>
              <td>{machine.name}</td>
              <td>{machine.lineId?.name}</td>
              <td>{latestMetrics ? `${Math.round(latestMetrics.performanceRate * 100)}%` : "—"}</td>
              <td>{latestMetrics ? `${Math.round(latestMetrics.oee * 100)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
