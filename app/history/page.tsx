"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exposure = {
  id: string;
  food_id: string;
  eaten_at: string;
  preference: string | null;
  notes: string | null;
};

type Food = {
  id: string;
  name: string;
};

type DateRange = "all" | "7" | "30";
type ViewMode = "history" | "foods";

function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
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
      return "Not recorded";
  }
}

function isWithinRange(dateString: string, range: DateRange) {
  if (range === "all") {
    return true;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(`${dateString}T00:00:00`);
  const days = range === "7" ? 7 : 30;

  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - (days - 1));

  return date >= cutoff && date <= today;
}

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("history");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setMessage("");

      const { data: exposureData, error: exposureError } = await supabase
        .from("food_exposures")
        .select("id, food_id, eaten_at, preference, notes")
        .order("eaten_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (exposureError) {
        setMessage(exposureError.message);
        setLoading(false);
        return;
      }

      const { data: foodData, error: foodError } = await supabase
        .from("foods")
        .select("id, name")
        .order("name");

      if (foodError) {
        setMessage(foodError.message);
        setLoading(false);
        return;
      }

      setExposures((exposureData ?? []) as Exposure[]);
      setFoods((foodData ?? []) as Food[]);
      setLoading(false);
    }

    loadHistory();
  }, []);

  const foodNameMap = useMemo(() => {
    return new Map(foods.map((food) => [food.id, food.name]));
  }, [foods]);

  const filteredHistory = useMemo(() => {
    return exposures.filter((exposure) =>
      isWithinRange(exposure.eaten_at, dateRange)
    );
  }, [exposures, dateRange]);

  const foodsTried = useMemo(() => {
    const foodIdsInSelectedRange = new Set(
      exposures
        .filter((exposure) => isWithinRange(exposure.eaten_at, dateRange))
        .map((exposure) => exposure.food_id)
    );

    const summaries = Array.from(foodIdsInSelectedRange).map((foodId) => {
      const allTimeExposures = exposures
        .filter((exposure) => exposure.food_id === foodId)
        .sort((a, b) => a.eaten_at.localeCompare(b.eaten_at));

      const firstExposure = allTimeExposures[0];
      const mostRecentExposure =
        allTimeExposures[allTimeExposures.length - 1];

      return {
        foodId,
        foodName: foodNameMap.get(foodId) ?? "Unknown food",
        firstDate: firstExposure?.eaten_at ?? "",
        mostRecentDate: mostRecentExposure?.eaten_at ?? "",
        count: allTimeExposures.length,
        latestPreference: mostRecentExposure?.preference ?? null,
      };
    });

    return summaries.sort((a, b) =>
      b.mostRecentDate.localeCompare(a.mostRecentDate)
    );
  }, [exposures, dateRange, foodNameMap]);

  if (loading) {
    return (
      <main className="app-shell">
        <p>Loading food history...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">Thea&apos;s Food History</h1>

      <p className="page-subtitle">
        See every exposure or review each food Thea has tried.
      </p>

      <nav className="nav-card">
        <a href="/" className="nav-link">
          🏠 Home
        </a>

        <a href="/history" className="nav-link active">
          📖 History
        </a>

        <a href="/allergens" className="nav-link">
          🥜 Allergens
        </a>
      </nav>

      {message && <p className="message">{message}</p>}

      <section className="card">
        <h2 className="section-title">View</h2>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            className={
              viewMode === "history"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setViewMode("history")}
          >
            Complete Food History
          </button>

          <button
            className={
              viewMode === "foods"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setViewMode("foods")}
          >
            Foods Tried
          </button>
        </div>
      </section>

      <section className="card soft">
        <h2 className="section-title">Date Range</h2>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            className={
              dateRange === "all"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setDateRange("all")}
          >
            All Time
          </button>

          <button
            className={
              dateRange === "7"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setDateRange("7")}
          >
            Past 7 Days
          </button>

          <button
            className={
              dateRange === "30"
                ? "primary-button"
                : "secondary-button"
            }
            onClick={() => setDateRange("30")}
          >
            Past 30 Days
          </button>
        </div>
      </section>

      {viewMode === "history" && (
        <>
          {filteredHistory.length === 0 ? (
            <section className="card">
              <p className="muted" style={{ margin: 0 }}>
                No food exposures in this date range.
              </p>
            </section>
          ) : (
            filteredHistory.map((exposure) => (
              <section className="card" key={exposure.id}>
                <h2 className="section-title">
                  {foodNameMap.get(exposure.food_id) ?? "Unknown food"}
                </h2>

                <p>
                  <strong>{formatDate(exposure.eaten_at)}</strong>
                </p>

                <p>
                  Preference:{" "}
                  <strong>
                    {getPreferenceLabel(exposure.preference)}
                  </strong>
                </p>

                {exposure.notes && (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {exposure.notes}
                  </p>
                )}
              </section>
            ))
          )}
        </>
      )}

      {viewMode === "foods" && (
        <>
          {foodsTried.length === 0 ? (
            <section className="card">
              <p className="muted" style={{ margin: 0 }}>
                No foods were eaten in this date range.
              </p>
            </section>
          ) : (
            foodsTried.map((food) => (
              <section className="card" key={food.foodId}>
                <h2 className="section-title">{food.foodName}</h2>

                <p>
                  First tried:{" "}
                  <strong>{formatDate(food.firstDate)}</strong>
                </p>

                <p>
                  Most recent:{" "}
                  <strong>{formatDate(food.mostRecentDate)}</strong>
                </p>

                <p>
                  Total exposures: <strong>{food.count}</strong>
                </p>

                <p style={{ marginBottom: 0 }}>
                  Latest preference:{" "}
                  <strong>
                    {getPreferenceLabel(food.latestPreference)}
                  </strong>
                </p>
              </section>
            ))
          )}
        </>
      )}
    </main>
  );
}
