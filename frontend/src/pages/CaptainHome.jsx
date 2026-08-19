import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../api/auth.jsx";
import StatusBadge from "../components/StatusBadge";

// Section 12.1 of the Master Guideline: home screen shows the assigned
// line's machines, any active critical alerts, and a prominent Report
// Breakdown entry point.
export default function CaptainHome() {
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user?.assignedLineId) {
        setLoading(false);
        return;
      }
      const lineId = user.assignedLineId._id || user.assignedLineId;
      const [machinesRes, reportsRes] = await Promise.all([
        client.get(`/lines/${lineId}/machines`),
        client.get("/breakdowns/mine"),
      ]);
      setMachines(machinesRes.data);
      setMyReports(reportsRes.data);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <div className="content">Loading...</div>;

  if (!user?.assignedLineId) {
    return (
      <div className="content">
        <div className="card">
          You are not currently assigned to a line. Contact your Admin to be assigned.
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your Machines</h3>
        <p className="muted">Tap a machine to view its status, FMEA/Pareto view, and to report a breakdown.</p>
        <div className="grid">
          {machines.map((m) => (
            <Link key={m._id} to={`/machine/${m._id}`} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <strong>{m.name}</strong>
              <div className="muted">Criticality: {m.criticality}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My Recent Reports</h3>
        {myReports.length === 0 && <p className="muted">No reports submitted yet.</p>}
        <table>
          <thead>
            <tr><th>Machine</th><th>Component</th><th>Status</th></tr>
          </thead>
          <tbody>
            {myReports.slice(0, 10).map((r) => (
              <tr key={r._id}>
                <td>{r.machineId?.name}</td>
                <td>{r.componentId?.name}</td>
                <td><StatusBadge status={r.status === "Resolved" ? "Normal" : r.status === "Open" ? "Critical" : "Acknowledged"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
