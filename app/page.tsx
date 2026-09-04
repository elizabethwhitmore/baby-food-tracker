"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Food = {
  id: string;
  name: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [babyId, setBabyId] = useState("");
  const [babyName, setBabyName] = useState("");
  const [plantGoal, setPlantGoal] = useState<number | null>(null);

  const [foods, setFoods] = useState<Food[]>([]);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [preference, setPreference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
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

    setBabyId(baby.id);
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

  async function loadFoods() {
    const { data, error } = await supabase
      .from("foods")
      .select("id, name")
      .order("name");

    if (error) {
      setMessage(error.message);
      return;
    }

    setFoods(data ?? []);
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
        await loadFoods();
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
    await loadFoods();

    setSigningIn(false);
  }

  async function saveFoodExposure() {
    setMessage("");

    if (!selectedFoodId) {
      setMessage("Please choose a food.");
      return;
    }

    setSavingFood(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Could not identify the signed-in user.");
      setSavingFood(false);
      return;
    }

    const { error } = await supabase.from("food_exposures").insert({
      baby_id: babyId,
      food_id: selectedFoodId,
      preference: preference || null,
      notes: notes || null,
      recorded_by: user.id,
    });

    if (error) {
      setMessage(error.message);
      setSavingFood(false);
      return;
    }

    setMessage("Food saved!");
    setSelectedFoodId("");
    setPreference("");
    setNotes("");
    setSavingFood(false);
  }

  async function signOut() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setBabyId("");
    setBabyName("");
    setPlantGoal(null);
    setFoods([]);
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

        <label>
          Food
          <select
            value={selectedFoodId}
            onChange={(e) => setSelectedFoodId(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginTop: "8px",
              marginBottom: "16px",
            }}
          >
            <option value="">Choose a food</option>

            {foods.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Preference
          <select
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginTop: "8px",
              marginBottom: "16px",
            }}
          >
            <option value="">Not recorded</option>
            <option value="loved">Loved ❤️</option>
            <option value="liked">Liked 🙂</option>
            <option value="neutral">Neutral 😐</option>
            <option value="disliked">Didn&apos;t like 🙅‍♀️</option>
          </select>
        </label>

        <label>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginTop: "8px",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />
        </label>

        <button
          onClick={saveFoodExposure}
          disabled={savingFood}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
          }}
        >
          {savingFood ? "Saving..." : "Save food"}
        </button>
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
