import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14 }}>{user.name} · {user.role}</span>
        <button className="btn secondary" onClick={logout}>Log Out</button>
      </div>
    </div>
  );
}

// Stores the current location in navigation state so Login can redirect
// back to it after a successful sign-in (fixes: token expires on /machine/xyz,
// user logs in and was sent to home instead of back where they were).
function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    // Wrong role for this page — send to their correct home
    const home = user.role === "Captain" ? "/captain" : "/admin";
    return <Navigate to={home} replace />;
  }
  return children;
}

// Root "/" decides where to send a logged-in user
function Root() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "Captain") return <Navigate to="/captain" replace />;
  return <Navigate to="/admin" replace />;
}

function NotFound() {
  return (
    <div className="content" style={{ textAlign: "center", paddingTop: 60 }}>
      <h2>404 — Page not found</h2>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn" style={{ display: "inline-block" }}>Go Home</a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-shell">
        <TopBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Root />} />

          <Route
            path="/captain"
            element={
              <RequireAuth roles={["Captain"]}>
                <CaptainHome />
              </RequireAuth>
            }
          />
          <Route
            path="/machine/:id"
            element={
              <RequireAuth>
                <MachineDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={["Admin", "Engineer"]}>
                <AdminDashboard />
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
