"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Allergen = {
  id: string;
  name: string;
};

type Exposure = {
  food_id: string;
  eaten_at: string;
};

type FoodAllergen = {
  food_id: string;
  allergen_id: string;
};

type AllergenSummary = {
  id: string;
  name: string;
  count: number;
  mostRecent: string | null;
};

const allergenEmojis: Record<string, string> = {
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

function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AllergensPage() {
  const [allergens, setAllergens] = useState<AllergenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAllergens() {
      setLoading(true);
      setMessage("");

      const { data: majorAllergens, error: allergenError } = await supabase
        .from("allergens")
        .select("id, name")
        .eq("is_major_us_allergen", true)
        .order("name");

      if (allergenError) {
        setMessage(allergenError.message);
        setLoading(false);
        return;
      }

      const { data: exposures, error: exposureError } = await supabase
        .from("food_exposures")
        .select("food_id, eaten_at");

      if (exposureError) {
        setMessage(exposureError.message);
        setLoading(false);
        return;
      }

      const exposedFoodIds = [
        ...new Set((exposures ?? []).map((exposure) => exposure.food_id)),
      ];

      let foodAllergenMappings: FoodAllergen[] = [];

      if (exposedFoodIds.length > 0) {
        const { data: mappings, error: mappingError } = await supabase
          .from("food_allergens")
          .select("food_id, allergen_id")
          .in("food_id", exposedFoodIds);

        if (mappingError) {
          setMessage(mappingError.message);
          setLoading(false);
          return;
        }

        foodAllergenMappings = mappings ?? [];
      }

      const summaries: AllergenSummary[] = (
        (majorAllergens ?? []) as Allergen[]
      ).map((allergen) => {
        const matchingFoodIds = new Set(
          foodAllergenMappings
            .filter((mapping) => mapping.allergen_id === allergen.id)
            .map((mapping) => mapping.food_id)
        );

        const matchingExposures = ((exposures ?? []) as Exposure[]).filter(
          (exposure) => matchingFoodIds.has(exposure.food_id)
        );

        const dates = matchingExposures
          .map((exposure) => exposure.eaten_at)
          .sort();

        return {
          id: allergen.id,
          name: allergen.name,
          count: matchingExposures.length,
          mostRecent: dates.length > 0 ? dates[dates.length - 1] : null,
        };
      });

      setAllergens(summaries);
      setLoading(false);
    }

    loadAllergens();
  }, []);

  const introducedCount = allergens.filter(
    (allergen) => allergen.count > 0
  ).length;

  if (loading) {
    return (
      <main className="app-shell">
        <p>Loading allergens...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">Thea&apos;s Allergens</h1>

      <p className="page-subtitle">
        Track Thea&apos;s exposure to the major U.S. food allergens.
      </p>

      <nav className="nav-card">
        <a href="/" className="nav-link">
          🏠 Home
        </a>

        <a href="/history" className="nav-link">
          📖 History
        </a>

        <a href="/allergens" className="nav-link active">
          🥜 Allergens
        </a>
      </nav>

      {message && <p className="message">{message}</p>}

      <section className="card soft">
        <h2 className="section-title">Allergen Progress</h2>

        <p className="big-number">
          {introducedCount} / {allergens.length}
        </p>

        <p className="muted" style={{ marginBottom: 0 }}>
          major allergens introduced
        </p>
      </section>

      {allergens.map((allergen) => {
        const emoji = allergenEmojis[allergen.name] ?? "🍽️";

        return (
          <section className="card" key={allergen.id}>
            <h2 className="section-title">
              {emoji} {allergen.name}
            </h2>

            {allergen.count > 0 ? (
              <>
                <p>
                  <strong>
                    {allergen.count}{" "}
                    {allergen.count === 1 ? "exposure" : "exposures"}
                  </strong>
                </p>

                <p className="muted" style={{ marginBottom: 0 }}>
                  Most recent:{" "}
                  {allergen.mostRecent
                    ? formatDate(allergen.mostRecent)
                    : "Not recorded"}
                </p>
              </>
            ) : (
              <p className="muted" style={{ marginBottom: 0 }}>
                Not yet introduced
              </p>
            )}
          </section>
        );
      })}
    </main>
  );
}
