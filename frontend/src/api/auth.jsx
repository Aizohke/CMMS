import { createContext, useContext, useState } from "react";
import client from "./client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("cmms_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Internal helper - stores token + user after any successful auth
  function _persist(token, userData) {
    localStorage.setItem("cmms_token", token);
    localStorage.setItem("cmms_user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  // Email + password login
  async function login(email, password) {
    const { data } = await client.post("/auth/login", { email, password });
    return _persist(data.token, data.user);
  }

  // Email + password signup (self-registration)
  async function signup(name, email, password) {
    const { data } = await client.post("/auth/signup", { name, email, password });
    return _persist(data.token, data.user);
  }

  // Google or phone - frontend gets a Firebase ID token, backend verifies it
  async function firebaseAuth(idToken) {
    const { data } = await client.post("/auth/firebase", { idToken });
    return _persist(data.token, data.user);
  }

  // Refresh user from /me (e.g. after admin updates a line assignment)
  async function refreshUser() {
    try {
      const { data } = await client.get("/auth/me");
      const stored = localStorage.getItem("cmms_token");
      localStorage.setItem("cmms_user", JSON.stringify(data));
      setUser(data);
    } catch {
      // If the token expired, the client interceptor will redirect to /login
    }
  }

  function logout() {
    localStorage.removeItem("cmms_token");
    localStorage.removeItem("cmms_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, firebaseAuth, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
