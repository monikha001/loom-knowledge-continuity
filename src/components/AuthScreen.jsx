
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LockKeyhole, Mail, User, ArrowRight, Layers3 } from "lucide-react";
import "./AuthScreen.css";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (password.length < 8) {
          throw new Error("Password must contain at least 8 characters.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created successfully. Opening your workspace...");
        } else {
          setMessage(
            "Account created! Check your email to confirm your account, then sign in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-decoration">
        <div className="auth-decoration-circle circle-one" />
        <div className="auth-decoration-circle circle-two" />
        <div className="auth-brand">
          <div className="auth-logo">L</div>
          <div>
            <strong>LOOM<span>.</span></strong>
            <small>KNOWLEDGE CONTINUITY</small>
          </div>
        </div>

        <div className="auth-message">
          <span className="auth-eyebrow">ORGANISATIONAL INTELLIGENCE</span>
          <h1>Knowledge is what keeps everything moving.</h1>
          <p>
            Connect what your organisation knows. Protect what matters.
            Preserve continuity through every transition.
          </p>
          <div className="auth-decoration-footer">
            <Layers3 size={17} />
            <span>Connected knowledge. Continuous operations.</span>
          </div>
        </div>
      </div>

      <section className="auth-form-area">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <div className="auth-logo">L</div>
            <strong>LOOM<span>.</span></strong>
          </div>

          <div className="auth-form-heading">
            <span className="auth-eyebrow">YOUR KNOWLEDGE WORKSPACE</span>
            <h2>
              {mode === "login" ? "Welcome back." : "Create your account."}
            </h2>
            <p>
              {mode === "login"
                ? "Sign in to access your organisation's knowledge."
                : "Start building a connected knowledge workspace."}
            </p>
          </div>

          <div className="auth-mode-tabs">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "selected" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <label>
                Full name
                <div className="auth-input">
                  <User size={17} />
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label>
              Email address
              <div className="auth-input">
                <Mail size={17} />
                <input
                  type="email"
                  placeholder="name@organisation.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </label>

            <label>
              Password
              <div className="auth-input">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "signup" && (
                <small className="password-hint">
                  Use at least 8 characters.
                </small>
              )}
            </label>

            {error && (
              <div className="auth-alert error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="auth-alert success" role="status">
                {message}
              </div>
            )}

            <button className="auth-submit" disabled={loading} type="submit">
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign in to LOOM"
                : "Create my account"}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="auth-security">
            <LockKeyhole size={13} />
            Your organisation's knowledge deserves protection.
          </p>
        </div>
      </section>
    </main>
  );
}
