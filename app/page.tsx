"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Signed in successfully!");
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        maxWidth: "420px",
        margin: "80px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Thea's Food Tracker</h1>

      <p>Sign in to track Thea&apos;s foods, plants, allergens, and favorites.</p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          padding: "12px",
          marginTop: "20px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          padding: "12px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={signIn}
        disabled={loading}
        style={{
          padding: "12px 18px",
          cursor: "pointer",
        }}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {message && <p style={{ marginTop: "16px" }}>{message}</p>}
    </main>
  );
}
