import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../api/auth.jsx";
import StatusBadge from "../components/StatusBadge";

export default function CaptainHome() {
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      // Bug fix: assignedLineId may be a plain string (from localStorage) or a
      // populated object (from a fresh /auth/me call). Both cases handled here.
      const rawLine = user?.assignedLineId;
      if (!rawLine) {
        setLoading(false);
        return;
      }
      const lineId = typeof rawLine === "object" ? rawLine._id : rawLine;

      try {
        const [machinesRes, reportsRes] = await Promise.all([
          client.get(`/lines/${lineId}/machines`),
          client.get("/breakdowns/mine"),
        ]);
        setMachines(machinesRes.data);
        setMyReports(reportsRes.data);
      } catch (err) {
        setError("Failed to load your line data. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="content">
        <div className="card loading-card">Loading your line…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content">
        <div className="card"><p className="error-text">{error}</p></div>
      </div>
    );
  }

  if (!user?.assignedLineId) {
    return (
      <div className="content">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Not yet assigned to a line</h3>
          <p className="muted">
            Your account has been created but you haven't been assigned to a production
            line yet. Contact your Admin to be assigned — you'll see your machines here
            once that's done.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your Machines</h3>
        <p className="muted">
          Tap a machine to view its status and report a breakdown.
        </p>
        <div className="grid">
          {machines.map((m) => (
            <Link
              key={m._id}
              to={`/machine/${m._id}`}
              className="card machine-link"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.name}</strong>
              <div className="muted">Criticality: {m.criticality}</div>
            </Link>
          ))}
          {machines.length === 0 && (
            <p className="muted">No machines found on your line.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My Recent Reports</h3>
        {myReports.length === 0 ? (
          <p className="muted">No reports submitted yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Component</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {myReports.slice(0, 15).map((r) => (
                <tr key={r._id}>
                  <td>{r.machineId?.name || "—"}</td>
                  <td>{r.componentId?.name || "—"}</td>
                  <td>
                    <StatusBadge
                      status={
                        r.status === "Resolved"
                          ? "Normal"
                          : r.status === "Open"
                          ? "Critical"
                          : "Acknowledged"
                      }
                    />
                  </td>
                  <td className="muted">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
