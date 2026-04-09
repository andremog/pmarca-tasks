"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0e09", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif",
    }}>
      <div style={{
        maxWidth: 360, width: "90%", padding: 32, background: "#161510",
        border: "1px solid #1e1d16", borderRadius: 10,
      }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22,
          fontWeight: 700, color: "#f0e8d0", marginBottom: 4,
        }}>
          pmarca <em style={{ color: "#c9a84c" }}>tasks</em>
        </h1>
        <p style={{
          fontFamily: "monospace", fontSize: 11, color: "#5a5440",
          marginBottom: 24, letterSpacing: ".04em",
        }}>
          Sign in with magic link
        </p>

        {sent ? (
          <p style={{ color: "#6aaa6a", fontSize: 14 }}>
            ✓ Check your email for the magic link.
          </p>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: "100%", padding: "12px 14px", background: "#1a1914",
                border: "1px solid #252318", borderRadius: 6, color: "#ede8de",
                fontSize: 14, outline: "none", marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <button type="submit" style={{
              width: "100%", padding: 12, background: "#c9a84c", border: "none",
              borderRadius: 6, color: "#1a1410", fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: "monospace", letterSpacing: ".04em",
            }}>
              Send Magic Link
            </button>
            {error && <p style={{ color: "#c97070", fontSize: 12, marginTop: 8 }}>{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
