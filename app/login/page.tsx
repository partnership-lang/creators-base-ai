"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = isConfigured ? createClient() : null;

  async function signInWithGoogle() {
    if (!supabase) return;
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });
    if (error) setMessage(error.message);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`
      }
    });
    setMessage(error ? error.message : "Check your email for login link.");
  }

  return (
    <main className="container" style={{ maxWidth: 560, paddingTop: 60 }}>
      <div className="card">
        <h1>Creators Base AI</h1>
        {!isConfigured && (
          <p>
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env.local</code>, then restart <code>npm run dev</code>.
          </p>
        )}
        <p>Login with Google or magic link.</p>

        <div className="actions" style={{ marginBottom: 12 }}>
          <button onClick={signInWithGoogle}>Continue with Google</button>
        </div>

        <form onSubmit={sendMagicLink} className="grid">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="secondary">
            Send magic link
          </button>
        </form>

        {message && <p style={{ marginTop: 8 }}>{message}</p>}
      </div>
    </main>
  );
}
