import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../api/auth.jsx";
import { signInWithGoogle, setupRecaptcha, sendOtp, isConfigured } from "../api/firebase.js";

// Redirects the user to the correct page for their role after login/signup.
// Bug fix: previously always sent Captains to "/" which caused a double-redirect.
// Now resolves directly to the right page. Also honours a "from" location so
// a user who was on /machine/xyz when their token expired goes back there.
function usePostLoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  return function redirect(user) {
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    if (user.role === "Captain") navigate("/captain", { replace: true });
    else navigate("/admin", { replace: true });
  };
}

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "phone"
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          L'ORÉAL EA <span>PLANT CMMS</span>
        </div>

        {mode === "login" && <LoginForm onSwitch={setMode} />}
        {mode === "signup" && <SignupForm onSwitch={setMode} />}
        {mode === "phone" && <PhoneForm onSwitch={setMode} />}
      </div>
    </div>
  );
}

// ─── Email + password login ────────────────────────────────────────────────

function LoginForm({ onSwitch }) {
  const { login } = useAuth();
  const redirect = usePostLoginRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      redirect(user);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">Sign In</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>

      <GoogleButton />
      <PhoneButton onSwitch={onSwitch} />

      <p className="auth-switch">
        No account?{" "}
        <button className="link-btn" onClick={() => onSwitch("signup")}>
          Create one
        </button>
      </p>
    </>
  );
}

// ─── Email + password signup ───────────────────────────────────────────────

function SignupForm({ onSwitch }) {
  const { signup } = useAuth();
  const redirect = usePostLoginRedirect();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const user = await signup(name, email, password);
      redirect(user);
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="auth-title">Create Account</h2>
      <p className="auth-note">
        New accounts are created as <strong>Line Captain</strong> by default.
        An Admin will assign you to your line.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Full Name</label>
          <input value={name} autoComplete="name"
            onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Email</label>
          <input type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="form-row">
          <label>Confirm Password</label>
          <input type="password" value={confirm} autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>
      <GoogleButton />
      <PhoneButton onSwitch={onSwitch} />

      <p className="auth-switch">
        Already have an account?{" "}
        <button className="link-btn" onClick={() => onSwitch("login")}>
          Sign in
        </button>
      </p>
    </>
  );
}

// ─── Phone OTP ────────────────────────────────────────────────────────────

function PhoneForm({ onSwitch }) {
  const { firebaseAuth } = useAuth();
  const redirect = usePostLoginRedirect();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const btnRef = useRef(null);

  // Set up the invisible reCAPTCHA on the send-OTP button once
  useEffect(() => {
    if (!isConfigured) return;
    try {
      setupRecaptcha("send-otp-btn");
    } catch { /* already set up */ }
  }, []);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Format: user types 0712345678, we prepend +254 (Kenya)
      // If the user already typed +, use as-is
      const formatted = phone.startsWith("+") ? phone : `+254${phone.replace(/^0/, "")}`;
      const conf = await sendOtp(formatted);
      setConfirmation(conf);
    } catch (err) {
      setError(err.message || "Failed to send OTP. Check the phone number.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await confirmation.confirm(otp);
      const idToken = await result.user.getIdToken();
      const user = await firebaseAuth(idToken);
      redirect(user);
    } catch (err) {
      setError("Incorrect code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isConfigured) {
    return (
      <>
        <h2 className="auth-title">Phone Sign-In</h2>
        <p className="error-text">
          Firebase is not configured. Add the VITE_FIREBASE_* keys to{" "}
          <code>frontend/.env</code> to enable phone and Google sign-in.
        </p>
        <button className="link-btn" onClick={() => onSwitch("login")}>
          ← Back to Sign In
        </button>
      </>
    );
  }

  return (
    <>
      <h2 className="auth-title">Sign In with Phone</h2>
      {!confirmation ? (
        <form onSubmit={handleSendOtp}>
          <div className="form-row">
            <label>Phone Number</label>
            <input type="tel" value={phone} placeholder="0712 345 678"
              onChange={(e) => setPhone(e.target.value)} required />
            <span className="muted" style={{ fontSize: 12 }}>
              Kenya numbers: enter 07xx xxx xxx. Include country code (+254…) for other countries.
            </span>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button id="send-otp-btn" className="btn" type="submit"
            disabled={loading} style={{ width: "100%" }}>
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <p className="muted">Enter the 6-digit code sent to {phone}.</p>
          <div className="form-row">
            <label>One-Time Code</label>
            <input type="text" inputMode="numeric" maxLength={6} value={otp}
              onChange={(e) => setOtp(e.target.value)} required autoFocus />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Verifying…" : "Verify & Sign In"}
          </button>
          <button type="button" className="link-btn" style={{ marginTop: 8 }}
            onClick={() => setConfirmation(null)}>
            ← Try a different number
          </button>
        </form>
      )}
      <p className="auth-switch">
        <button className="link-btn" onClick={() => onSwitch("login")}>
          ← Back to Sign In
        </button>
      </p>
    </>
  );
}

// ─── Shared OAuth buttons ──────────────────────────────────────────────────

function GoogleButton() {
  const { firebaseAuth } = useAuth();
  const redirect = usePostLoginRedirect();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const user = await firebaseAuth(idToken);
      redirect(user);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("");
      } else {
        setError(err.message || "Google sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn-social"
        onClick={handleGoogle}
        disabled={loading || !isConfigured}
        title={!isConfigured ? "Firebase not configured — add VITE_FIREBASE_* to frontend/.env" : ""}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 10, flexShrink: 0 }}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>
      {error && <p className="error-text" style={{ marginTop: 4 }}>{error}</p>}
    </>
  );
}

function PhoneButton({ onSwitch }) {
  return (
    <button
      className="btn-social"
      onClick={() => onSwitch("phone")}
      disabled={!isConfigured}
      title={!isConfigured ? "Firebase not configured — add VITE_FIREBASE_* to frontend/.env" : ""}
    >
      <span style={{ marginRight: 10, fontSize: 18 }}>📱</span>
      Continue with Phone Number
    </button>
  );
}
