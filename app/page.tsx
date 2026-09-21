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
  notes: string | null;
  eaten_at: string;
};

type PreviewFood = {
  inputName: string;
  foodId: string | null;
  canonicalName: string | null;
  preference: string | null;
  notes: string | null;
  eatenAt: string;
  matched: boolean;
};

type IronExposure = {
  id: string;
  foodName: string;
  eatenAt: string;
};

type IronView = "calendar" | "list";

type FoodMetadata = {
  food_name: string;
  category: string;
  subcategory: string | null;
  is_iron_rich: boolean;
  plant_types: string[];
  allergens: string[];
  aliases: string[];
};

type MealIdea = {
  title: string;
  foods: string[];
  why_it_works: string;
  new_food: string | null;
  iron_rich: boolean;
};

const APPROVED_ALLERGENS = [
  "Milk",
  "Egg",
  "Peanut",
  "Tree Nuts",
  "Wheat",
  "Soy",
  "Sesame",
  "Fish",
  "Crustacean Shellfish",
  "Molluscan Shellfish",
];

export default function Home() {
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);

  const [babyId, setBabyId] = useState("");
  const [babyName, setBabyName] = useState("");

  const [plantGoal, setPlantGoal] = useState<number | null>(null);
  const [plantCount, setPlantCount] = useState(0);
  const [weeklyPlantTypes, setWeeklyPlantTypes] = useState<string[]>([]);
  const [showPlantTypes, setShowPlantTypes] = useState(false);

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

  const [metadataByIndex, setMetadataByIndex] = useState<
    Record<number, FoodMetadata>
  >({});

  const [suggestingIndex, setSuggestingIndex] =
    useState<number | null>(null);

  const [addingIndex, setAddingIndex] =
    useState<number | null>(null);

  const [mealIdeas, setMealIdeas] = useState<MealIdea[]>([]);
  const [loadingMealIdeas, setLoadingMealIdeas] = useState(false);
  const [mealIdeasMessage, setMealIdeasMessage] = useState("");

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
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  function formatReviewDate(dateString: string) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  function getPreferenceLabel(value: string | null) {
    switch (value) {
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

    const { data: exposures, error: exposureError } =
      await supabase
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
      setWeeklyPlantTypes([]);
      return;
    }

    const { data: mappings, error: mappingError } =
      await supabase
        .from("food_plant_types")
        .select("plant_type_id")
        .in("food_id", foodIds);

    if (mappingError) {
      setMessage(mappingError.message);
      return;
    }

    const plantTypeIds = [
      ...new Set((mappings ?? []).map((mapping) => mapping.plant_type_id)),
    ];

    setPlantCount(plantTypeIds.length);

    if (plantTypeIds.length === 0) {
      setWeeklyPlantTypes([]);
      return;
    }

    const { data: plantTypes, error: plantTypesError } =
      await supabase
        .from("plant_types")
        .select("id, name")
        .in("id", plantTypeIds)
        .order("name");

    if (plantTypesError) {
      setMessage(plantTypesError.message);
      return;
    }

    setWeeklyPlantTypes(
      (plantTypes ?? []).map((plantType) => plantType.name)
    );
  }

  async function loadIronExposures(currentBabyId: string) {
    const cutoff = getSevenDayCutoff();

    const { data: ironFoods, error: ironFoodsError } =
      await supabase
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

    const { data: exposures, error: exposureError } =
      await supabase
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

    const recentIronExposures: IronExposure[] =
      (exposures ?? []).map((exposure) => ({
        id: exposure.id,
        foodName:
          ironFoodNameMap.get(exposure.food_id) ?? "Unknown food",
        eatenAt: exposure.eaten_at,
      }));

    setIronExposures(recentIronExposures);
  }

  async function loadBabyData() {
    const { data: baby, error: babyError } =
      await supabase
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

    const { data: settings, error: settingsError } =
      await supabase
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
    const { data: foodData, error: foodError } =
      await supabase
        .from("foods")
        .select("id, name, show_in_dropdown")
        .order("name");

    if (foodError) {
      setMessage(foodError.message);
      return;
    }

    const { data: aliasData, error: aliasError } =
      await supabase
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
async function sendPasswordReset() {
  setMessage("");

  if (!email.trim()) {
    setMessage("Enter your email address first.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    {
      redirectTo:
        "https://thea-food-tracker.vercel.app/reset-password",
    }
  );

  if (error) {
    setMessage(error.message);
    return;
  }

  setMessage(
    "Password reset email sent! Check your inbox."
  );
}
  async function signIn() {
    setSigningIn(true);
    setMessage("");

    const { error } =
      await supabase.auth.signInWithPassword({
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

    const { error } =
      await supabase
        .from("food_exposures")
        .insert({
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
    setMetadataByIndex({});

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
          today: getLocalDateString(new Date()),
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

      const preview: PreviewFood[] =
        parsedFoods.map((parsed) => {
          const normalized = normalizeFoodName(parsed.food);

          const canonicalMatch =
            canonicalMap.get(normalized);

          const aliasMatch =
            aliasMap.get(normalized);

          const match =
            canonicalMatch ?? aliasMatch ?? null;

          return {
            inputName: parsed.food,
            foodId: match?.id ?? null,
            canonicalName: match?.name ?? null,
            preference: parsed.preference,
            notes: parsed.notes,
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

  async function suggestFoodMetadata(index: number) {
    const item = aiPreview[index];

    if (!item || item.matched) {
      return;
    }

    setMessage("");
    setSuggestingIndex(index);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setMessage("Your sign-in session could not be found.");
        return;
      }

      const response = await fetch(
        "/api/suggest-food-metadata",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            food_name: item.inputName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ?? "Could not suggest food information."
        );
        return;
      }

      setMetadataByIndex((current) => ({
        ...current,
        [index]: result as FoodMetadata,
      }));
    } catch {
      setMessage(
        "Something went wrong while preparing the new food."
      );
    } finally {
      setSuggestingIndex(null);
    }
  }

  function updateMetadata(
    index: number,
    updates: Partial<FoodMetadata>
  ) {
    setMetadataByIndex((current) => {
      const existing = current[index];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [index]: {
          ...existing,
          ...updates,
        },
      };
    });
  }

  function toggleMetadataAllergen(
    index: number,
    allergen: string
  ) {
    const metadata = metadataByIndex[index];

    if (!metadata) {
      return;
    }

    const alreadySelected =
      metadata.allergens.includes(allergen);

    const allergens =
      alreadySelected
        ? metadata.allergens.filter(
            (item) => item !== allergen
          )
        : [...metadata.allergens, allergen];

    updateMetadata(index, {
      allergens,
    });
  }

  async function addFoodToLibrary(index: number) {
    const metadata = metadataByIndex[index];
    const previewItem = aiPreview[index];

    if (!metadata || !previewItem) {
      return;
    }

    if (!metadata.food_name.trim()) {
      setMessage("Food name is required.");
      return;
    }

    setMessage("");
    setAddingIndex(index);

    const aliasSet =
      new Set(
        metadata.aliases
          .map((alias) => alias.trim())
          .filter(Boolean)
      );

    if (
      normalizeFoodName(previewItem.inputName) !==
      normalizeFoodName(metadata.food_name)
    ) {
      aliasSet.add(previewItem.inputName.trim());
    }

    const {
      data: newFoodId,
      error,
    } = await supabase.rpc(
      "add_food_to_library",
      {
        new_food_name: metadata.food_name.trim(),
        new_category:
          metadata.category.trim() || null,
        new_subcategory:
          metadata.subcategory?.trim() || null,
        new_is_iron_rich:
          metadata.is_iron_rich,
        new_plant_types:
          metadata.plant_types
            .map((plant) => plant.trim())
            .filter(Boolean),
        new_allergens:
          metadata.allergens,
        new_aliases:
          Array.from(aliasSet),
      }
    );

    if (error || !newFoodId) {
      setMessage(
        error?.message ??
          "Could not add the food to the library."
      );
      setAddingIndex(null);
      return;
    }

    setAiPreview((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              foodId: newFoodId as string,
              canonicalName:
                metadata.food_name.trim(),
              matched: true,
            }
          : item
      )
    );

    setMetadataByIndex((current) => {
      const next = { ...current };

      delete next[index];

      return next;
    });

    await loadFoodsAndAliases();

    setMessage(
      `${metadata.food_name.trim()} was added to Thea's food library. ✓`
    );

    setAddingIndex(null);
  }

  async function saveAiFoods() {
    setMessage("");

    if (aiPreview.length === 0) {
      setMessage("There is nothing to save.");
      return;
    }

    const unmatched =
      aiPreview.filter((item) => !item.matched);

    if (unmatched.length > 0) {
      setMessage(
        "One or more foods still need to be added or matched before saving."
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

    const rows =
      aiPreview.map((item) => ({
        baby_id: babyId,
        food_id: item.foodId,
        preference: item.preference,
        notes: item.notes,
        eaten_at: item.eatenAt,
        recorded_by: user.id,
      }));

    const { error } =
      await supabase
        .from("food_exposures")
        .insert(rows);

    if (error) {
      setMessage(error.message);
      setSavingAi(false);
      return;
    }

    setAiText("");
    setAiPreview([]);
    setMetadataByIndex({});

    await loadPlantCount(babyId);
    await loadIronExposures(babyId);

    setMessage("Foods saved! ✓");
    setSavingAi(false);
  }

  async function generateMealIdeas() {
    setMealIdeasMessage("");
    setMealIdeas([]);
    setLoadingMealIdeas(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setMealIdeasMessage(
          "Your sign-in session could not be found."
        );
        return;
      }

      const response = await fetch("/api/meal-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          count: 3,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMealIdeasMessage(
          result.error ?? "Could not generate meal ideas."
        );
        return;
      }

      if (!Array.isArray(result.meals)) {
        setMealIdeasMessage(
          "The meal ideas response was not valid."
        );
        return;
      }

      setMealIdeas(result.meals as MealIdea[]);
    } catch {
      setMealIdeasMessage(
        "Something went wrong while generating meal ideas."
      );
    } finally {
      setLoadingMealIdeas(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setBabyId("");
    setBabyName("");

    setPlantGoal(null);
    setPlantCount(0);
    setWeeklyPlantTypes([]);
    setShowPlantTypes(false);

    setIronExposures([]);

    setFoods([]);
    setAliases([]);

    setAiText("");
    setAiPreview([]);
    setMetadataByIndex({});

    setMealIdeas([]);
    setMealIdeasMessage("");

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
        style={{
          maxWidth: "460px",
        }}
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
              onChange={(e) =>
                setEmail(e.target.value)
              }
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
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              style={{
                marginTop: "8px",
                marginBottom: "18px",
              }}
            />
            <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "-8px",
    marginBottom: "16px",
    fontSize: "14px",
    cursor: "pointer",
  }}
>
  <input
    type="checkbox"
    checked={showPassword}
    onChange={(e) => setShowPassword(e.target.checked)}
  />
  Show password
</label>
          </label>

          <button
            className="primary-button"
            onClick={signIn}
            disabled={signingIn}
          >
            {signingIn
              ? "Signing in..."
              : "Sign in"}
          </button>

          {message && (
            <p className="message">
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">
        {babyName || "Thea"}
        &apos;s Food Tracker
      </h1>

      <p className="page-subtitle">
        A simple place to track foods, preferences, plants,
        and allergens.
      </p>

      <nav className="nav-card">
        <a
          href="/"
          className="nav-link active"
        >
          🏠 Home
        </a>

        <a
          href="/history"
          className="nav-link"
        >
          📖 History
        </a>

        <a
          href="/allergens"
          className="nav-link"
        >
          🥜 Allergens
        </a>
      </nav>

      <section className="card green">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "14px",
          }}
        >
          <h2
            className="section-title"
            style={{ marginBottom: 0 }}
          >
            🌱 This Week
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
            <span>View Plant Types</span>

            <input
              type="checkbox"
              checked={showPlantTypes}
              onChange={(e) =>
                setShowPlantTypes(e.target.checked)
              }
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
              }}
            />
          </label>
        </div>

        <p className="big-number">
          {plantCount} / {plantGoal ?? 25}
        </p>

        <p
          className="muted"
          style={{
            marginBottom: showPlantTypes ? "16px" : 0,
          }}
        >
          different plant types
        </p>

        {showPlantTypes && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {weeklyPlantTypes.length > 0 ? (
              weeklyPlantTypes.map((plantType) => (
                <span
                  key={plantType}
                  style={{
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    padding: "7px 11px",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  🌿 {plantType}
                </span>
              ))
            ) : (
              <span className="muted">
                No plant types recorded this week yet.
              </span>
            )}
          </div>
        )}
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
            ✨ Add Food
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
                setMetadataByIndex({});
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
                    gap: "12px",
                  }}
                >
                  {aiPreview.map((item, index) => {
                    const metadata =
                      metadataByIndex[index];

                    return (
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

                            {item.notes && (
                              <p
                                style={{
                                  margin: "8px 0 0",
                                  lineHeight: 1.5,
                                }}
                              >
                                Notes:{" "}
                                <strong>
                                  {item.notes}
                                </strong>
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <strong>
                              ⚠️ {item.inputName}
                            </strong>

                            <p
                              className="muted"
                              style={{
                                margin: "8px 0 12px",
                              }}
                            >
                              This food isn&apos;t in
                              Thea&apos;s food library yet.
                            </p>

                            {item.notes && (
                              <p
                                style={{
                                  margin: "0 0 12px",
                                  lineHeight: 1.5,
                                }}
                              >
                                Notes:{" "}
                                <strong>
                                  {item.notes}
                                </strong>
                              </p>
                            )}

                            {!metadata && (
                              <button
                                className="secondary-button"
                                onClick={() =>
                                  suggestFoodMetadata(index)
                                }
                                disabled={
                                  suggestingIndex === index
                                }
                              >
                                {suggestingIndex === index
                                  ? "Preparing..."
                                  : "+ Review & add to food library"}
                              </button>
                            )}

                            {metadata && (
                              <div
                                style={{
                                  marginTop: "16px",
                                  paddingTop: "16px",
                                  borderTop:
                                    "1px solid var(--border)",
                                }}
                              >
                                <h4
                                  style={{
                                    margin: "0 0 14px",
                                    fontSize: "18px",
                                  }}
                                >
                                  Review food details
                                </h4>

                                <label className="label">
                                  Food name

                                  <input
                                    className="field"
                                    value={metadata.food_name}
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        food_name:
                                          e.target.value,
                                      })
                                    }
                                    style={{
                                      marginTop: "8px",
                                      marginBottom: "14px",
                                    }}
                                  />
                                </label>

                                <label className="label">
                                  Category

                                  <input
                                    className="field"
                                    value={metadata.category}
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        category:
                                          e.target.value,
                                      })
                                    }
                                    style={{
                                      marginTop: "8px",
                                      marginBottom: "14px",
                                    }}
                                  />
                                </label>

                                <label className="label">
                                  Subcategory

                                  <input
                                    className="field"
                                    value={
                                      metadata.subcategory ?? ""
                                    }
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        subcategory:
                                          e.target.value || null,
                                      })
                                    }
                                    style={{
                                      marginTop: "8px",
                                      marginBottom: "14px",
                                    }}
                                  />
                                </label>

                                <label className="label">
                                  Plant type
                                  {metadata.plant_types.length > 1
                                    ? "s"
                                    : ""}

                                  <input
                                    className="field"
                                    value={metadata.plant_types.join(
                                      ", "
                                    )}
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        plant_types:
                                          e.target.value
                                            .split(",")
                                            .map((value) =>
                                              value.trim()
                                            )
                                            .filter(Boolean),
                                      })
                                    }
                                    style={{
                                      marginTop: "8px",
                                      marginBottom: "14px",
                                    }}
                                  />
                                </label>

                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "9px",
                                    marginBottom: "16px",
                                    fontWeight: 600,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      metadata.is_iron_rich
                                    }
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        is_iron_rich:
                                          e.target.checked,
                                      })
                                    }
                                  />

                                  Iron-rich food
                                </label>

                                <div
                                  style={{
                                    marginBottom: "16px",
                                  }}
                                >
                                  <span className="label">
                                    Allergens
                                  </span>

                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "8px 14px",
                                      marginTop: "8px",
                                    }}
                                  >
                                    {APPROVED_ALLERGENS.map(
                                      (allergen) => (
                                        <label
                                          key={allergen}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            fontSize: "14px",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={metadata.allergens.includes(
                                              allergen
                                            )}
                                            onChange={() =>
                                              toggleMetadataAllergen(
                                                index,
                                                allergen
                                              )
                                            }
                                          />

                                          {allergen}
                                        </label>
                                      )
                                    )}
                                  </div>
                                </div>

                                <label className="label">
                                  Aliases

                                  <input
                                    className="field"
                                    value={metadata.aliases.join(
                                      ", "
                                    )}
                                    onChange={(e) =>
                                      updateMetadata(index, {
                                        aliases:
                                          e.target.value
                                            .split(",")
                                            .map((value) =>
                                              value.trim()
                                            )
                                            .filter(Boolean),
                                      })
                                    }
                                    style={{
                                      marginTop: "8px",
                                      marginBottom: "16px",
                                    }}
                                  />
                                </label>

                                <button
                                  className="primary-button"
                                  onClick={() =>
                                    addFoodToLibrary(index)
                                  }
                                  disabled={
                                    addingIndex === index
                                  }
                                >
                                  {addingIndex === index
                                    ? "Adding..."
                                    : "Add to food library"}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

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
                    onClick={() => {
                      setAiPreview([]);
                      setMetadataByIndex({});
                    }}
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
          <p className="message">
            {message}
          </p>
        )}
      </section>

      <section className="card soft">
        <h2 className="section-title">
          💡 Meal Ideas
        </h2>

        <p className="muted">
          Meal ideas based on Thea&apos;s actual food history,
          including at least one liked or loved food and no more
          than one new food per meal.
        </p>

        <button
          className="primary-button"
          onClick={generateMealIdeas}
          disabled={loadingMealIdeas}
        >
          {loadingMealIdeas
            ? "Thinking..."
            : mealIdeas.length > 0
            ? "✨ Suggest New Meal Ideas"
            : "✨ Suggest Meal Ideas"}
        </button>

        {mealIdeasMessage && (
          <p className="message">
            {mealIdeasMessage}
          </p>
        )}

        {mealIdeas.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginTop: "20px",
            }}
          >
            {mealIdeas.map((meal, index) => (
              <div
                key={`${meal.title}-${index}`}
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontFamily:
                      'Georgia, "Times New Roman", serif',
                    fontSize: "21px",
                  }}
                >
                  {meal.title}
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {meal.foods.map((food) => (
                    <span
                      key={food}
                      style={{
                        background: "var(--card-soft)",
                        border:
                          "1px solid var(--border)",
                        borderRadius: "999px",
                        padding: "7px 11px",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      {food}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {meal.new_food && (
                    <span
                      style={{
                        background: "var(--accent-soft)",
                        borderRadius: "999px",
                        padding: "6px 10px",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      ✨ New food: {meal.new_food}
                    </span>
                  )}

                  {meal.iron_rich && (
                    <span
                      style={{
                        background: "var(--green-soft)",
                        borderRadius: "999px",
                        padding: "6px 10px",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      🫘 Iron-rich
                    </span>
                  )}
                </div>

                <p
                  className="muted"
                  style={{
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {meal.why_it_works}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card soft">
        <h2 className="section-title">
          🫘 Iron-Rich Foods
        </h2>

        <p className="muted">
          Thea&apos;s iron-rich foods over the past 7 days.
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
                  {day.hadIron
                    ? "✅"
                    : "—"}
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
                No iron-rich foods recorded in the past 7 days.
              </p>
            ) : (
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
                      alignItems: "center",
                      gap: "16px",
                      paddingBottom: "10px",
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatShortDate(exposure.eatenAt)}
                    </span>
                  </div>
                ))}
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
