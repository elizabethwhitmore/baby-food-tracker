"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [babyName, setBabyName] = useState("");
  const [plantGoal, setPlantGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApp() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.reload();
        return;
      }

      const { data: baby, error: babyError } = await supabase
        .from("babies")
        .select("id, name")
        .limit(1)
        .single();

      if (babyError || !baby) {
        setLoading(false);
        return;
      }

      setBabyName(baby.name);

      const { data: settings } = await supabase
        .from("baby_settings")
        .select("weekly_plant_goal")
        .eq("baby_id", baby.id)
        .single();

      if (settings) {
        setPlantGoal(settings.weekly_plant_goal);
      }

      setLoading(false);
    }

    loadApp();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (loading) {
    return <main style={{ padding: "40px" }}>Loading...</main>;
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
      <h1>{babyName}&apos;s Food Tracker</h1>

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
          Soon you&apos;ll be able to tell me what Thea ate in normal
          language.
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
          Meals will include at least one safe food, no more than one new
          food, and can include previously disliked foods for repeat exposure.
        </p>
      </section>

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
