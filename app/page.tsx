"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Food = {
  id: string;
  name: string;
};

type IronExposure = {
  id: string;
  foodName: string;
  eatenAt: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [babyId, setBabyId] = useState("");
  const [babyName, setBabyName] = useState("");
  const [plantGoal, setPlantGoal] = useState<number | null>(null);
  const [plantCount, setPlantCount] = useState(0);
  const [ironExposures, setIronExposures] = useState<IronExposure[]>([]);

  const [foods, setFoods] = useState<Food[]>([]);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [preference, setPreference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState("");

  function getLocalDateString(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function formatDate(dateString: string) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStartOfWeek() {
    const today = new Date();
    const day = today.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);

    return getLocalDateString(monday);
  }

  function getFourteenDayCutoff() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 13);
    return getLocalDateString(cutoff);
  }

  async function loadPlantCount(currentBabyId: string) {
    const startOfWeek = getStartOfWeek();

    const { data: exposures, error: exposureError } = await supabase
      .from("food_exposures")
      .select("food_id")
      .eq("baby_id", currentBabyId)
      .gte("eaten_at", startOfWeek);

    if (exposureError) {
      setMessage(exposureError.message);
      return;
    }

    const foodIds = [
      ...new Set((exposures ?? []).map((exposure) => exposure.food_id)),
    ];

    if (foodIds.length === 0) {
      setPlantCount(0);
      return;
    }

    const { data: mappings, error: mappingError } = await supabase
      .from("food_plant_types")
      .select("plant_type_id")
      .in("food_id", foodIds);

    if (mappingError) {
      setMessage(mappingError.message);
      return;
    }

    const uniquePlants = new Set(
      (mappings ?? []).map((mapping) => mapping.plant_type_id)
    );

    setPlantCount(uniquePlants.size);
  }

  async function loadIronExposures(currentBabyId: string) {
    const cutoff = getFourteenDayCutoff();

    const { data: ironFoods, error: ironFoodsError } = await supabase
      .from("foods")
      .select("id, name")
      .eq("is_iron_rich", true);

    if (ironFoodsError) {
      setMessage(ironFoodsError.message);
      return;
    }

    if (!ironFoods || ironFoods.length === 0) {
      setIronExposures([]);
      return;
    }

    const ironFoodIds = ironFoods.map((food) => food.id);

    const ironFoodNameMap = new Map(
      ironFoods.map((food) => [food.id, food.name])
    );

    const { data: exposures, error: exposureError } = await supabase
      .from("food_exposures")
      .select("id, food_id, eaten_at")
      .eq("baby_id", currentBabyId)
      .gte("eaten_at", cutoff)
      .in("food_id", ironFoodIds)
      .order("eaten_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    if (exposureError) {
      setMessage(exposureError.message);
      return;
    }

    const recentIronExposures: IronExposure[] = (exposures ?? []).map(
      (exposure) => ({
        id: exposure.id,
        foodName:
          ironFoodNameMap.get(exposure.food_id) ?? "Unknown food",
        eatenAt: exposure.eaten_at,
      })
    );

    setIronExposures(recentIronExposures);
  }

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

    await loadPlantCount(baby.id);
    await loadIronExposures(baby.id);
  }

  async function loadFoods() {
    const { data, error } = await supabase
      .from("foods")
      .select("id, name")
      .eq("show_in_dropdown", true)
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

    setSelectedFoodId("");
    setPreference("");
    setNotes("");

    await loadPlantCount(babyId);
    await loadIronExposures(babyId);

    setMessage("Food saved! ✓");
    setSavingFood(false);
  }

  async function signOut() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setBabyId("");
    setBabyName("");
    setPlantGoal(null);
    setPlantCount(0);
    setIronExposures([]);
    setFoods([]);
    setEmail("");
    setPassword("");
    setMessage("");
  }

  if (loading) {
    return (
      <main className="app-shell">
        <p>Loading...</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="app-shell" style={{ maxWidth: "460px" }}>
        <h1 className="page-title">Thea&apos;s Food Tracker</h1>

        <p className="page-subtitle">
          Sign in to track Thea&apos;s food journey.
        </p>

        <section className="card">
          <label className="label">
            Email

            <input
              className="field"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                marginTop: "8px",
                marginBottom: "16px",
              }}
            />
          </label>

          <label className="label">
            Password

            <input
              className="field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                marginTop: "8px",
                marginBottom: "18px",
              }}
            />
          </label>

          <button
            className="primary-button"
            onClick={signIn}
            disabled={signingIn}
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </button>

          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">
        {babyName || "Thea"}&apos;s Food Tracker
      </h1>

      <p className="page-subtitle">
        A simple place to track foods, preferences, plants, and allergens.
      </p>

      <nav className="nav-card">
        <a href="/" className="nav-link active">
          🏠 Home
        </a>

        <a href="/history" className="nav-link">
          📖 History
        </a>

        <a href="/allergens" className="nav-link">
          🥜 Allergens
        </a>
      </nav>

      <section className="card green">
        <h2 className="section-title">🌱 This Week</h2>

        <p className="big-number">
          {plantCount} / {plantGoal ?? 25}
        </p>

        <p className="muted" style={{ marginBottom: 0 }}>
          different plant types
        </p>
      </section>

      <section className="card soft">
        <h2 className="section-title">🫘 Iron-Rich Foods Recently</h2>

        {ironExposures.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            No iron-rich foods recorded in the past 14 days.
          </p>
        ) : (
          <>
            <p className="muted">
              Thea&apos;s 5 most recent iron-rich food exposures from the
              past 14 days:
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {ironExposures.map((exposure) => (
                <div
                  key={exposure.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <strong>{exposure.foodName}</strong>

                  <span className="muted">
                    {formatDate(exposure.eatenAt)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">🍓 Log Food</h2>

        <label className="label">
          Food

          <select
            className="select-field"
            value={selectedFoodId}
            onChange={(e) => setSelectedFoodId(e.target.value)}
          >
            <option value="">Choose a food</option>

            {foods.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Preference

          <select
            className="select-field"
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
          >
            <option value="">Not recorded</option>
            <option value="loved">Loved ❤️</option>
            <option value="liked">Liked 🙂</option>
            <option value="neutral">Neutral 😐</option>
            <option value="disliked">Didn't like 🙅‍♀️</option>
          </select>
        </label>

        <label className="label">
          Notes

          <textarea
            className="textarea-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </label>

        <button
          className="primary-button"
          onClick={saveFoodExposure}
          disabled={savingFood}
        >
          {savingFood ? "Saving..." : "Save food"}
        </button>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="card soft">
        <h2 className="section-title">💡 Meal Ideas</h2>

        <p className="muted" style={{ marginBottom: 0 }}>
          At least one safe food, no more than one new food, with repeat
          exposure encouraged.
        </p>
      </section>

      <button
        className="secondary-button"
        onClick={signOut}
        style={{ marginTop: "24px" }}
      >
        Sign out
      </button>
    </main>
  );
}
