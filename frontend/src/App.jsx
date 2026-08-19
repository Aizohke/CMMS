import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./api/auth.jsx";
import Login from "./pages/Login";
import CaptainHome from "./pages/CaptainHome";
import MachineDetail from "./pages/MachineDetail";
import AdminDashboard from "./pages/AdminDashboard";

function TopBar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="top-bar">
      <div className="brand">L'ORÉAL EA <span>PLANT CMMS</span></div>
      <div>
        <span style={{ marginRight: 12 }}>{user.name} · {user.role}</span>
        <button className="btn secondary" onClick={logout}>Log Out</button>
      </div>
    </div>
  );
}

function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Root() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Captain") return <Navigate to="/captain" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <TopBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Root />} />
          <Route path="/captain" element={<RequireAuth roles={["Captain"]}><CaptainHome /></RequireAuth>} />
          <Route path="/machine/:id" element={<RequireAuth><MachineDetail /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={["Admin", "Engineer"]}><AdminDashboard /></RequireAuth>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
