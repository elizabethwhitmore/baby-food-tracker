"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exposure = {
  id: string;
  eaten_at: string;
  preference: string | null;
  notes: string | null;
  foods: {
    name: string;
  } | null;
};

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadHistory() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase
        .from("food_exposures")
        .select(`
          id,
          eaten_at,
          preference,
          notes,
          foods (
            name
          )
        `)
        .order("eaten_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setExposures((data as Exposure[]) ?? []);
      }

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
      <h1>Thea&apos;s Food History</h1>

      <p>
        Everything Thea has tried, with her preferences and notes.
      </p>

      {message && <p>{message}</p>}

      {exposures.length === 0 ? (
        <p>No foods logged yet.</p>
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
              {exposure.foods?.name ?? "Unknown food"}
            </h2>

            <p>
              <strong>Date:</strong> {exposure.eaten_at}
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
