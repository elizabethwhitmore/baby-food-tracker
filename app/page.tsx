"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [babyName, setBabyName] = useState("");
  const [plantGoal, setPlantGoal] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");

  async function loadBabyData() {
    const { data: baby, error: babyError } = await supabase
      .from("babies")
      .select("id, name")
      .limit(1)
      .single();

    if (babyError || !baby) {
      setMessage(
        babyError?.message ?? "Could not find Thea's baby record."
      );
      return;
    }

    setBabyName(baby.name);

    const { data: settings, error: settingsError } = await supabase
      .from("baby_settings")
      .select("weekly_plant_goal")
      .eq("baby_id", baby.id)
      .single();

    if (settingsError) {
      setMessage(settingsError.message);
      return;
    }

    setPlantGoal(settings.weekly_plant_goal);
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (session) {
        setSignedIn(true);
        await loadBabyData();
      }

      setLoading(false);
    }

    checkSession();
  }, []);

  async function signIn() {
    setSigningIn(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setSigningIn(false);
      return;
    }

    setSignedIn(true);
    await loadBabyData();

    setSigningIn(false);
  }

  async function signOut() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setBabyName("");
    setPlantGoal(null);
    setEmail("");
    setPassword("");
    setMessage("");
  }

  if (loading) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
        Loading...
      </main>
    );
  }

  if (!signedIn) {
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
          disabled={signingIn}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
          }}
        >
          {signingIn ? "Signing in..." : "Sign in"}
        </button>

        {message && <p style={{ marginTop: "16px" }}>{message}</p>}
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "500px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>{babyName || "Thea"}&apos;s Food Tracker</h1>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          marginTop: "30px",
        }}
      >
        <h2>🌱 This Week</h2>

        <p style={{ fontSize: "32px", fontWeight: "bold" }}>
          0 / {plantGoal ?? 25}
        </p>

        <p>different plant types</p>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          marginTop: "16px",
        }}
      >
        <h2>🍓 Log Food</h2>
        <p>
          Soon you&apos;ll be able to tell me what Thea ate in normal language.
        </p>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          marginTop: "16px",
        }}
      >
        <h2>💡 Meal Ideas</h2>
        <p>
          Meals will include at least one safe food, no more than one new food,
          and can include previously disliked foods for repeat exposure.
        </p>
      </section>

      {message && <p style={{ marginTop: "16px" }}>{message}</p>}

      <button
        onClick={signOut}
        style={{
          marginTop: "30px",
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </main>
  );
}
