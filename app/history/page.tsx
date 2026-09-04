"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exposure = {
  id: string;
  food_id: string;
  food_name: string;
  eaten_at: string;
  preference: string | null;
  notes: string | null;
};

type ViewMode = "history" | "foods";
type DateRange = "all" | "7" | "30";

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("history");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    async function loadHistory() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setMessage(sessionError.message);
        setLoading(false);
        return;
      }

      if (!session) {
        window.location.href = "/";
        return;
      }

      const { data: exposureData, error: exposureError } = await supabase
        .from("food_exposures")
        .select(`
          id,
          food_id,
          eaten_at,
          preference,
          notes,
          created_at
        `)
        .order("eaten_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (exposureError) {
        setMessage(exposureError.message);
        setLoading(false);
        return;
      }

      if (!exposureData || exposureData.length === 0) {
        setExposures([]);
        setLoading(false);
        return;
      }

      const foodIds = [
        ...new Set(exposureData.map((exposure) => exposure.food_id)),
      ];

      const { data: foodData, error: foodError } = await supabase
        .from("foods")
        .select("id, name")
        .in("id", foodIds);

      if (foodError) {
        setMessage(foodError.message);
        setLoading(false);
        return;
      }

      const foodNames = new Map(
        (foodData ?? []).map((food) => [food.id, food.name])
      );

      const history: Exposure[] = exposureData.map((exposure) => ({
        id: exposure.id,
        food_id: exposure.food_id,
        food_name: foodNames.get(exposure.food_id) ?? "Unknown food",
        eaten_at: exposure.eaten_at,
        preference: exposure.preference,
        notes: exposure.notes,
      }));

      setExposures(history);
      setLoading(false);
    }

    loadHistory();
  }, []);

  function preferenceLabel(preference: string | null) {
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

  function formatDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function getCutoffDate(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - (days - 1));

    return cutoff;
  }

  const filteredExposures = useMemo(() => {
    if (dateRange === "all") {
      return exposures;
    }

    const days = dateRange === "7" ? 7 : 30;
    const cutoff = getCutoffDate(days);

    return exposures.filter((exposure) => {
      const [year, month, day] = exposure.eaten_at.split("-").map(Number);
      const eatenDate = new Date(year, month - 1, day);

      return eatenDate >= cutoff;
    });
  }, [exposures, dateRange]);

  const foodsTried = useMemo(() => {
    const grouped = new Map<
      string,
      {
        food_id: string;
        food_name: string;
        exposures: Exposure[];
      }
    >();

    for (const exposure of filteredExposures) {
      const existing = grouped.get(exposure.food_id);

      if (existing) {
        existing.exposures.push(exposure);
      } else {
        grouped.set(exposure.food_id, {
          food_id: exposure.food_id,
          food_name: exposure.food_name,
          exposures: [exposure],
        });
      }
    }

    return [...grouped.values()]
      .map((group) => {
        const sortedAscending = [...group.exposures].sort((a, b) =>
          a.eaten_at.localeCompare(b.eaten_at)
        );

        const sortedDescending = [...group.exposures].sort((a, b) =>
          b.eaten_at.localeCompare(a.eaten_at)
        );

        return {
          food_id: group.food_id,
          food_name: group.food_name,
          exposure_count: group.exposures.length,
          first_tried: sortedAscending[0]?.eaten_at ?? "",
          last_tried: sortedDescending[0]?.eaten_at ?? "",
          latest_preference:
            sortedDescending[0]?.preference ?? null,
        };
      })
      .sort((a, b) => b.last_tried.localeCompare(a.last_tried));
  }, [filteredExposures]);

  const buttonStyle = (active: boolean) => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #bbb",
    cursor: "pointer",
    fontWeight: active ? "bold" : "normal",
    background: active ? "#eee" : "white",
  });

  if (loading) {
    return (
      <main
        style={{
          padding: "40px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Thea&apos;s Food History</h1>

      <p>
        Review every exposure or switch to a consolidated list of foods
        Thea has tried.
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "18px",
          marginTop: "24px",
        }}
      >
        <p style={{ marginTop: 0, fontWeight: "bold" }}>View</p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setViewMode("history")}
            style={buttonStyle(viewMode === "history")}
          >
            Complete Food History
          </button>

          <button
            onClick={() => setViewMode("foods")}
            style={buttonStyle(viewMode === "foods")}
          >
            Foods Tried
          </button>
        </div>

        <p
          style={{
            marginTop: "20px",
            marginBottom: "8px",
            fontWeight: "bold",
          }}
        >
          Date range
        </p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setDateRange("all")}
            style={buttonStyle(dateRange === "all")}
          >
            All Time
          </button>

          <button
            onClick={() => setDateRange("7")}
            style={buttonStyle(dateRange === "7")}
          >
            Past 7 Days
          </button>

          <button
            onClick={() => setDateRange("30")}
            style={buttonStyle(dateRange === "30")}
          >
            Past 30 Days
          </button>
        </div>
      </section>

      {message && (
        <p
          style={{
            marginTop: "20px",
            fontWeight: "bold",
          }}
        >
          {message}
        </p>
      )}

      {viewMode === "history" ? (
        <>
          {filteredExposures.length === 0 ? (
            <p style={{ marginTop: "30px" }}>
              No food exposures in this date range.
            </p>
          ) : (
            filteredExposures.map((exposure) => (
              <section
                key={exposure.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "16px",
                  padding: "18px",
                  marginTop: "12px",
                }}
              >
                <h2 style={{ marginTop: 0 }}>
                  {exposure.food_name}
                </h2>

                <p>
                  <strong>Date:</strong>{" "}
                  {formatDate(exposure.eaten_at)}
                </p>

                <p>
                  <strong>Preference:</strong>{" "}
                  {preferenceLabel(exposure.preference)}
                </p>

                {exposure.notes && (
                  <p>
                    <strong>Notes:</strong> {exposure.notes}
                  </p>
                )}
              </section>
            ))
          )}
        </>
      ) : (
        <>
          {foodsTried.length === 0 ? (
            <p style={{ marginTop: "30px" }}>
              No foods tried in this date range.
            </p>
          ) : (
            foodsTried.map((food) => (
              <section
                key={food.food_id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "16px",
                  padding: "18px",
                  marginTop: "12px",
                }}
              >
                <h2 style={{ marginTop: 0 }}>
                  {food.food_name}
                </h2>

                <p>
                  <strong>First tried:</strong>{" "}
                  {formatDate(food.first_tried)}
                </p>

                <p>
                  <strong>Most recent:</strong>{" "}
                  {formatDate(food.last_tried)}
                </p>

                <p>
                  <strong>Exposures:</strong>{" "}
                  {food.exposure_count}
                </p>

                <p>
                  <strong>Latest preference:</strong>{" "}
                  {preferenceLabel(food.latest_preference)}
                </p>
              </section>
            ))
          )}
        </>
      )}

      <p style={{ marginTop: "30px" }}>
        <a href="/">← Back to Home</a>
      </p>
    </main>
  );
}
