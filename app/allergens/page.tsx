"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type AllergenSummary = {
  id: string;
  name: string;
  exposureCount: number;
  lastExposure: string | null;
};

type Exposure = {
  id: string;
  food_id: string;
  eaten_at: string;
};

export default function AllergensPage() {
  const [allergens, setAllergens] = useState<AllergenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAllergens() {
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

      // Load the major U.S. allergens.
      const { data: allergenData, error: allergenError } = await supabase
        .from("allergens")
        .select("id, name")
        .eq("is_major_us_allergen", true)
        .order("name");

      if (allergenError) {
        setMessage(allergenError.message);
        setLoading(false);
        return;
      }

      // Load Thea's complete food exposure history.
      const { data: exposureData, error: exposureError } = await supabase
        .from("food_exposures")
        .select("id, food_id, eaten_at");

      if (exposureError) {
        setMessage(exposureError.message);
        setLoading(false);
        return;
      }

      const exposures = (exposureData ?? []) as Exposure[];

      // If no foods have been logged yet, every allergen is unintroduced.
      if (exposures.length === 0) {
        setAllergens(
          (allergenData ?? []).map((allergen) => ({
            id: allergen.id,
            name: allergen.name,
            exposureCount: 0,
            lastExposure: null,
          }))
        );

        setLoading(false);
        return;
      }

      const foodIds = [
        ...new Set(exposures.map((exposure) => exposure.food_id)),
      ];

      // Find which allergens are connected to foods Thea has eaten.
      const { data: mappingData, error: mappingError } = await supabase
        .from("food_allergens")
        .select("food_id, allergen_id")
        .in("food_id", foodIds);

      if (mappingError) {
        setMessage(mappingError.message);
        setLoading(false);
        return;
      }

      // Create a lookup:
      // food ID -> allergen IDs
      const allergensByFood = new Map<string, string[]>();

      for (const mapping of mappingData ?? []) {
        const existing = allergensByFood.get(mapping.food_id) ?? [];

        existing.push(mapping.allergen_id);

        allergensByFood.set(mapping.food_id, existing);
      }

      const summaries: AllergenSummary[] = (allergenData ?? []).map(
        (allergen) => {
          let exposureCount = 0;
          let lastExposure: string | null = null;

          for (const exposure of exposures) {
            const foodAllergens =
              allergensByFood.get(exposure.food_id) ?? [];

            if (foodAllergens.includes(allergen.id)) {
              exposureCount += 1;

              if (
                lastExposure === null ||
                exposure.eaten_at > lastExposure
              ) {
                lastExposure = exposure.eaten_at;
              }
            }
          }

          return {
            id: allergen.id,
            name: allergen.name,
            exposureCount,
            lastExposure,
          };
        }
      );

      setAllergens(summaries);
      setLoading(false);
    }

    loadAllergens();
  }, []);

  function formatDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function allergenEmoji(name: string) {
    const emojis: Record<string, string> = {
      Milk: "🥛",
      Egg: "🥚",
      Peanut: "🥜",
      "Tree Nuts": "🌰",
      Wheat: "🌾",
      Soy: "🫘",
      Sesame: "🌱",
      Fish: "🐟",
      "Crustacean Shellfish": "🦐",
    };

    return emojis[name] ?? "🍽️";
  }

  const introducedCount = allergens.filter(
    (allergen) => allergen.exposureCount > 0
  ).length;

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
      <h1>Thea&apos;s Allergens</h1>

      <p>
        Track allergen exposures automatically from Thea&apos;s food
        history.
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "20px",
          marginTop: "24px",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ marginTop: 0 }}>🥜 Allergen Progress</h2>

        <p
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "6px",
          }}
        >
          {introducedCount} / {allergens.length}
        </p>

        <p style={{ marginBottom: 0 }}>
          major allergens introduced
        </p>
      </section>

      {message && (
        <p
          style={{
            fontWeight: "bold",
            marginTop: "20px",
          }}
        >
          {message}
        </p>
      )}

      {allergens.map((allergen) => {
        const introduced = allergen.exposureCount > 0;

        return (
          <section
            key={allergen.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "16px",
              padding: "18px",
              marginTop: "12px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              {allergenEmoji(allergen.name)} {allergen.name}
            </h2>

            {introduced ? (
              <>
                <p>
                  <strong>Exposures:</strong>{" "}
                  {allergen.exposureCount}
                </p>

                <p>
                  <strong>Most recent:</strong>{" "}
                  {allergen.lastExposure
                    ? formatDate(allergen.lastExposure)
                    : "Not recorded"}
                </p>
              </>
            ) : (
              <p>
                <strong>Not yet introduced</strong>
              </p>
            )}
          </section>
        );
      })}

      <p style={{ marginTop: "30px" }}>
        <a href="/">← Back to Home</a>
      </p>
    </main>
  );
}
