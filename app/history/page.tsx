"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exposure = {
  id: string;
  food_id: string;
  food_name: string;
  eaten_at: string;
  preference: string | null;
  notes: string | null;
};

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

      // First get Thea's food exposure records.
      const { data: exposureData, error: exposureError } = await supabase
        .from("food_exposures")
        .select(`
          id,
          food_id,
          eaten_at,
          preference,
          notes
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

      // Get the unique food IDs from those exposures.
      const foodIds = [
        ...new Set(exposureData.map((exposure) => exposure.food_id)),
      ];

      // Look up the actual food names.
      const { data: foodData, error: foodError } = await supabase
        .from("foods")
        .select("id, name")
        .in("id", foodIds);

      if (foodError) {
        setMessage(foodError.message);
        setLoading(false);
        return;
      }

      // Make a quick food ID → food name lookup.
      const foodNames = new Map(
        (foodData ?? []).map((food) => [food.id, food.name])
      );

      // Combine each exposure with its food name.
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
        maxWidth: "500px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Thea&apos;s Food History</h1>

      <p>Everything Thea has tried, with her preferences and notes.</p>

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

      {exposures.length === 0 ? (
        <p style={{ marginTop: "30px" }}>
          No foods logged yet.
        </p>
      ) : (
        exposures.map((exposure) => (
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
              <strong>Date:</strong> {formatDate(exposure.eaten_at)}
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

      <p style={{ marginTop: "30px" }}>
        <a href="/">← Back to Home</a>
      </p>
    </main>
  );
}
