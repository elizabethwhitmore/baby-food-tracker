"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [babyName, setBabyName] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadBaby() {
    const { data, error } = await supabase
      .from("babies")
      .select("name")
      .limit(1)
      .single();

    if (error) {
      setMessage(`Could not load baby: ${error.message}`);
      return;
    }

    setBabyName(data.name);
  }

  async function signIn() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await loadBaby();
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setBabyName("");
    setMessage("");
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await loadBaby();
      }
    }

    checkSession();
  }, []);

  if (babyName) {
    return (
      <main
        style={{
          maxWidth: "420px",
          margin: "80px auto",
          padding: "24px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>{babyName}&apos;s Food Tracker</h1>

        <p>Welcome! You&apos;re signed in.</p>

        <p>
          Track {babyName}&apos;s foods, plants, allergens, iron-rich foods,
          and favorites.
        </p>

        <button
          onClick={signOut}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </main>
    );
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
      <h1>Thea&apos;s Food Tracker</h1>

      <p>
        Sign in to track Thea&apos;s foods, plants, allergens, and favorites.
      </p>

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
