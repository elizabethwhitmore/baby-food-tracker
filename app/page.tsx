"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Food = {
  id: string;
  name: string;
  show_in_dropdown: boolean;
};

type Alias = {
  alias: string;
  food_id: string;
};

type ParsedFood = {
  food: string;
  preference: string | null;
  eaten_at: string;
};

type PreviewFood = {
  inputName: string;
  foodId: string | null;
  canonicalName: string | null;
  preference: string | null;
  eatenAt: string;
  matched: boolean;
};

type IronExposure = {
  id: string;
  foodName: string;
  eatenAt: string;
};

type IronView = "calendar" | "list";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [babyId, setBabyId] = useState("");
  const [babyName, setBabyName] = useState("");
  const [plantGoal, setPlantGoal] = useState<number | null>(null);
  const [plantCount, setPlantCount] = useState(0);

  const [ironExposures, setIronExposures] = useState<IronExposure[]>([]);
  const [ironView, setIronView] = useState<IronView>("calendar");

  const [foods, setFoods] = useState<Food[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);

  const [manualMode, setManualMode] = useState(false);

  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [preference, setPreference] = useState("");
  const [notes, setNotes] = useState("");

  const [aiText, setAiText] = useState("");
  const [aiPreview, setAiPreview] = useState<PreviewFood[]>([]);
  const [parsingAi, setParsingAi] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

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

  function formatShortDate(dateString: string) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function formatReviewDate(dateString: string) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getPreferenceLabel(preference: string | null) {
    switch (preference) {
      case "loved":
        return "Loved ❤️";
      case "liked":
        return "Liked 🙂";
      case "neutral":
        return "Neutral 😐";
      case "disliked":
        return "Didn't like 🙅‍♀️";
      default:
        return "";
    }
  }

  function normalizeFoodName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ");
  }

  function getStartOfWeek() {
    const today = new Date();
    const day = today.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);

    return getLocalDateString(monday);
  }

  function getSevenDayCutoff() {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);

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
    const cutoff = getSevenDayCutoff();

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
      .select("id, food_id, eaten_at, created_at")
      .eq("baby_id", currentBabyId)
      .gte("eaten_at", cutoff)
      .in("food_id", ironFoodIds)
      .order("eaten_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (exposureError) {
      setMessage(exposureError.message);
      return;
    }

    const recentIronExposures: IronExposure[] = (exposures ?? []).map(
      (exposure) => ({
        id: exposure.id,
        foodName: ironFoodNameMap.get(exposure.food_id) ?? "Unknown food",
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

  async function loadFoodsAndAliases() {
    const { data: foodData, error: foodError } = await supabase
      .from("foods")
      .select("id, name, show_in_dropdown")
      .order("name");

    if (foodError) {
      setMessage(foodError.message);
      return;
    }

    const { data: aliasData, error: aliasError } = await supabase
      .from("food_aliases")
      .select("alias, food_id");

    if (aliasError) {
      setMessage(aliasError.message);
      return;
    }

    setFoods((foodData ?? []) as Food[]);
    setAliases((aliasData ?? []) as Alias[]);
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
        await loadFoodsAndAliases();
      }

      setLoading(false);
    }

    checkSession();
  }, []);

  const dropdownFoods = useMemo(() => {
    return foods.filter((food) => food.show_in_dropdown);
  }, [foods]);

  const lastSevenDays = useMemo(() => {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const dateString = getLocalDateString(date);

      const hadIron = ironExposures.some(
        (exposure) => exposure.eatenAt === dateString
      );

      days.push({
        dateString,
        weekday: date.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        dateLabel: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        hadIron,
      });
    }

    return days;
  }, [ironExposures]);

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
    await loadFoodsAndAliases();
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

  async function parseAiEntry() {
    setMessage("");
    setAiPreview([]);

    if (!aiText.trim()) {
      setMessage("Type what Thea ate first.");
      return;
    }

    setParsingAi(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setMessage("Your sign-in session could not be found.");
        return;
      }

      const response = await fetch("/api/parse-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: aiText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ?? "Could not understand the food entry."
        );
        return;
      }

      const parsedFoods = (result.foods ?? []) as ParsedFood[];

      if (parsedFoods.length === 0) {
        setMessage(
          "I couldn't find any foods Thea ate in that entry."
        );
        return;
      }

      const canonicalMap = new Map(
        foods.map((food) => [
          normalizeFoodName(food.name),
          food,
        ])
      );

      const foodById = new Map(
        foods.map((food) => [food.id, food])
      );

      const aliasMap = new Map<string, Food>();

      aliases.forEach((alias) => {
        const matchingFood = foodById.get(alias.food_id);

        if (matchingFood) {
          aliasMap.set(
            normalizeFoodName(alias.alias),
            matchingFood
          );
        }
      });

      const preview: PreviewFood[] = parsedFoods.map((parsed) => {
        const normalized = normalizeFoodName(parsed.food);

        const canonicalMatch = canonicalMap.get(normalized);
        const aliasMatch = aliasMap.get(normalized);
        const match = canonicalMatch ?? aliasMatch ?? null;

        return {
          inputName: parsed.food,
          foodId: match?.id ?? null,
          canonicalName: match?.name ?? null,
          preference: parsed.preference,
          eatenAt: parsed.eaten_at,
          matched: Boolean(match),
        };
      });

      setAiPreview(preview);
    } catch {
      setMessage(
        "Something went wrong while understanding the food entry."
      );
    } finally {
      setParsingAi(false);
    }
  }

  async function saveAiFoods() {
    setMessage("");

    if (aiPreview.length === 0) {
      setMessage("There is nothing to save.");
      return;
    }

    const unmatched = aiPreview.filter((item) => !item.matched);

    if (unmatched.length > 0) {
      setMessage(
        "One or more foods could not be matched to the food library. Nothing has been saved yet."
      );
      return;
    }

    setSavingAi(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Could not identify the signed-in user.");
      setSavingAi(false);
      return;
    }

    const rows = aiPreview.map((item) => ({
      baby_id: babyId,
      food_id: item.foodId,
      preference: item.preference,
      notes: null,
      eaten_at: item.eatenAt,
      recorded_by: user.id,
    }));

    const { error } = await supabase
      .from("food_exposures")
      .insert(rows);

    if (error) {
      setMessage(error.message);
      setSavingAi(false);
      return;
    }

    setAiText("");
    setAiPreview([]);

    await loadPlantCount(babyId);
    await loadIronExposures(babyId);

    setMessage("Foods saved! ✓");
    setSavingAi(false);
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
    setAliases([]);
    setAiText("");
    setAiPreview([]);
    setSelectedFoodId("");
    setPreference("");
    setNotes("");
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
      <main
        className="app-shell"
        style={{ maxWidth: "460px" }}
      >
        <h1 className="page-title">
          Thea&apos;s Food Tracker
        </h1>

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

          {message && (
            <p className="message">{message}</p>
          )}
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
        A simple place to track foods, preferences, plants,
        and allergens.
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
        <h2 className="section-title">
          🌱 This Week
        </h2>

        <p className="big-number">
          {plantCount} / {plantGoal ?? 25}
        </p>

        <p
          className="muted"
          style={{ marginBottom: 0 }}
        >
          different plant types
        </p>
      </section>

      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <h2
            className="section-title"
            style={{ marginBottom: 0 }}
          >
            Add Food
          </h2>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            <span>Add Food Manually</span>

            <input
              type="checkbox"
              checked={manualMode}
              onChange={(e) => {
                setManualMode(e.target.checked);
                setMessage("");
              }}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
              }}
            />
          </label>
        </div>

        {!manualMode ? (
          <>
            <p className="muted">
              Tell me what Thea ate in your own words.
              Nothing is saved until you review it.
            </p>

            <textarea
              className="textarea-field"
              value={aiText}
              onChange={(e) => {
                setAiText(e.target.value);
                setAiPreview([]);
              }}
              maxLength={1000}
              placeholder="Example: Yesterday Thea had banana and Greek yogurt. She loved the banana."
            />

            <button
              className="primary-button"
              onClick={parseAiEntry}
              disabled={parsingAi}
            >
              {parsingAi
                ? "Understanding..."
                : "Review entry"}
            </button>

            {aiPreview.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <h3
                  style={{
                    fontFamily:
                      'Georgia, "Times New Roman", serif',
                    fontSize: "22px",
                    marginTop: 0,
                    marginBottom: "14px",
                  }}
                >
                  Review foods
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {aiPreview.map((item, index) => (
                    <div
                      key={`${item.inputName}-${index}`}
                      style={{
                        border:
                          "1px solid var(--border)",
                        borderRadius: "14px",
                        padding: "14px",
                        background: "white",
                      }}
                    >
                      {item.matched ? (
                        <>
                          <strong>
                            {item.canonicalName}
                          </strong>

                          {item.preference && (
                            <p
                              style={{
                                margin: "8px 0 0",
                              }}
                            >
                              Preference:{" "}
                              <strong>
                                {getPreferenceLabel(
                                  item.preference
                                )}
                              </strong>
                            </p>
                          )}

                          <p
                            className="muted"
                            style={{
                              margin: "8px 0 0",
                            }}
                          >
                            Date:{" "}
                            {formatReviewDate(
                              item.eatenAt
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <strong>
                            ⚠️ {item.inputName}
                          </strong>

                          <p
                            className="muted"
                            style={{
                              margin: "8px 0 0",
                            }}
                          >
                            I couldn&apos;t match this
                            to a food in Thea&apos;s
                            library.
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {aiPreview.some(
                  (item) => !item.matched
                ) && (
                  <p
                    className="message"
                    style={{ marginTop: "14px" }}
                  >
                    Nothing will be saved until all
                    foods can be matched.
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginTop: "18px",
                  }}
                >
                  <button
                    className="primary-button"
                    onClick={saveAiFoods}
                    disabled={
                      savingAi ||
                      aiPreview.some(
                        (item) => !item.matched
                      )
                    }
                  >
                    {savingAi
                      ? "Saving..."
                      : "Save foods"}
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setAiPreview([])
                    }
                    disabled={savingAi}
                  >
                    Edit entry
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="label">
              Food

              <select
                className="select-field"
                value={selectedFoodId}
                onChange={(e) =>
                  setSelectedFoodId(e.target.value)
                }
              >
                <option value="">
                  Choose a food
                </option>

                {dropdownFoods.map((food) => (
                  <option
                    key={food.id}
                    value={food.id}
                  >
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
                onChange={(e) =>
                  setPreference(e.target.value)
                }
              >
                <option value="">
                  Not recorded
                </option>
                <option value="loved">
                  Loved ❤️
                </option>
                <option value="liked">
                  Liked 🙂
                </option>
                <option value="neutral">
                  Neutral 😐
                </option>
                <option value="disliked">
                  Didn&apos;t like 🙅‍♀️
                </option>
              </select>
            </label>

            <label className="label">
              Notes

              <textarea
                className="textarea-field"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                placeholder="Optional notes"
              />
            </label>

            <button
              className="primary-button"
              onClick={saveFoodExposure}
              disabled={savingFood}
            >
              {savingFood
                ? "Saving..."
                : "Save food"}
            </button>
          </>
        )}

        {message && (
          <p className="message">{message}</p>
        )}
      </section>

      <section className="card soft">
        <h2 className="section-title">
          💡 Meal Ideas
        </h2>

        <p
          className="muted"
          style={{ marginBottom: 0 }}
        >
          At least one safe food, no more than one
          new food, with repeat exposure encouraged.
        </p>
      </section>

      <section className="card soft">
        <h2 className="section-title">
          🫘 Iron-Rich Foods
        </h2>

        <p className="muted">
          Thea&apos;s iron-rich foods over the past
          7 days.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <button
            className={
              ironView === "calendar"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setIronView("calendar")
            }
          >
            📅 Calendar
          </button>

          <button
            className={
              ironView === "list"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() =>
              setIronView("list")
            }
          >
            🫘 Food List
          </button>
        </div>

        {ironView === "calendar" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(82px, 1fr))",
              gap: "10px",
            }}
          >
            {lastSevenDays.map((day) => (
              <div
                key={day.dateString}
                style={{
                  background: "white",
                  border:
                    "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "14px 8px",
                  textAlign: "center",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  {day.weekday}
                </strong>

                <span
                  className="muted"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    marginBottom: "10px",
                  }}
                >
                  {day.dateLabel}
                </span>

                <span
                  style={{
                    display: "block",
                    fontSize: "25px",
                    marginBottom: "5px",
                  }}
                >
                  {day.hadIron ? "✅" : "—"}
                </span>

                <span
                  className="muted"
                  style={{
                    fontSize: "12px",
                  }}
                >
                  {day.hadIron
                    ? "Iron-rich"
                    : "None"}
                </span>
              </div>
            ))}
          </div>
        )}

        {ironView === "list" && (
          <>
            {ironExposures.length === 0 ? (
              <p
                className="muted"
                style={{ marginBottom: 0 }}
              >
                No iron-rich foods recorded in the
                past 7 days.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {ironExposures.map(
                  (exposure) => (
                    <div
                      key={exposure.id}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        gap: "16px",
                        paddingBottom:
                          "10px",
                        borderBottom:
                          "1px solid var(--border)",
                      }}
                    >
                      <strong>
                        {exposure.foodName}
                      </strong>

                      <span
                        className="muted"
                        style={{
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatShortDate(
                          exposure.eatenAt
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
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
