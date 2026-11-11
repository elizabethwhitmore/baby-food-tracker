"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Exposure = {
  id: string;
  food_id: string;
  eaten_at: string;
  created_at: string;
  preference: string | null;
  notes: string | null;
  recorded_by: string | null;
};
type Food = { id: string; name: string; category: string | null };
type Member = { user_id: string; display_name: string | null };
type Range = "all" | "7" | "30";
type View = "foods" | "history";
type Summary = {
  id: string;
  name: string;
  category: string;
  count: number;
  first: string;
  last: string;
  preference: string | null;
};

const categories = [
  "Vegetables", "Fruits", "Grains", "Proteins", "Legumes", "Dairy",
  "Dairy Alternatives", "Nuts & Seeds", "Herbs & Spices", "Other",
];

function categoryLabel(value: string | null): string {
  switch ((value ?? "").trim().toLowerCase()) {
    case "vegetable": case "vegetables": return "Vegetables";
    case "fruit": case "fruits": return "Fruits";
    case "grain": case "grains": return "Grains";
    case "protein": case "proteins": return "Proteins";
    case "legume": case "legumes": return "Legumes";
    case "dairy": return "Dairy";
    case "dairy alternative": case "dairy alternatives": return "Dairy Alternatives";
    case "nut/seed": case "nuts/seeds": case "nuts & seeds": return "Nuts & Seeds";
    case "herb/spice": case "herb or spice": case "herbs & spices": return "Herbs & Spices";
    default: return "Other";
  }
}
function formatDate(value: string): string {
  if (!value) return "Unknown";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function preferenceLabel(value: string | null): string {
  switch (value) {
    case "loved": return "Loved ❤️";
    case "liked": return "Liked 🙂";
    case "neutral": return "Neutral 😐";
    case "disliked": return "Didn't like 🙅‍♀️";
    default: return "Not rated";
  }
}
function inRange(value: string, range: Range): boolean {
  if (range === "all") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - (range === "7" ? 6 : 29));
  const when = new Date(`${value}T00:00:00`);
  return when >= cutoff && when <= today;
}

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<View>("foods");
  const [range, setRange] = useState<Range>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setMessage("Please sign in on the Home page to see food history.");
        setLoading(false);
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from("household_members")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError) {
        setMessage(membershipError.message);
        setLoading(false);
        return;
      }
      setIsGuest(membership?.role === "guest");

      const [exposureResult, foodResult, memberResult] = await Promise.all([
        supabase.from("food_exposures")
          .select("id, food_id, eaten_at, created_at, preference, notes, recorded_by")
          .order("eaten_at", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("foods").select("id, name, category").order("name"),
        supabase.from("household_members").select("user_id, display_name"),
      ]);
      const error = exposureResult.error ?? foodResult.error ?? memberResult.error;
      if (error) {
        setMessage(error.message);
      } else {
        setExposures((exposureResult.data ?? []) as Exposure[]);
        setFoods((foodResult.data ?? []) as Food[]);
        setMembers((memberResult.data ?? []) as Member[]);
      }
      setLoading(false);
    }
    void load();
  }, []);

  const foodMap = useMemo(() => new Map(foods.map(f => [f.id, f])), [foods]);
  const memberMap = useMemo(() => new Map(members.map(m => [m.user_id, m.display_name ?? "Unknown"])), [members]);
  const filtered = useMemo(() => exposures.filter(e => inRange(e.eaten_at, range)), [exposures, range]);

  const summaries = useMemo(() => {
    const selected = new Set(filtered.map(e => e.food_id));
    const allByFood = new Map<string, Exposure[]>();
    for (const exposure of exposures) {
      const existing = allByFood.get(exposure.food_id) ?? [];
      existing.push(exposure);
      allByFood.set(exposure.food_id, existing);
    }
    const result: Summary[] = [];
    for (const id of selected) {
      const food = foodMap.get(id);
      const all = (allByFood.get(id) ?? []).slice().sort((a, b) =>
        a.eaten_at.localeCompare(b.eaten_at) || a.created_at.localeCompare(b.created_at)
      );
      if (!food || all.length === 0) continue;
      result.push({
        id,
        name: food.name,
        category: categoryLabel(food.category),
        count: all.length,
        first: all[0].eaten_at,
        last: all[all.length - 1].eaten_at,
        preference: all[all.length - 1].preference,
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, exposures, foodMap]);

  const visibleSummaries = useMemo(() => summaries.filter(s =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  ), [summaries, search]);

  async function deleteExposure(exposure: Exposure) {
    if (isGuest) return;
    const name = foodMap.get(exposure.food_id)?.name ?? "this food";
    if (!window.confirm(`Delete ${name} from ${formatDate(exposure.eaten_at)}?`)) return;
    setDeletingId(exposure.id);
    setMessage("");
    const { error } = await supabase.from("food_exposures").delete().eq("id", exposure.id);
    if (error) setMessage(error.message);
    else setExposures(old => old.filter(e => e.id !== exposure.id));
    setDeletingId(null);
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">Thea&apos;s Food History</h1>
      <p className="page-subtitle">Explore foods tried by category or see every recorded exposure.</p>
      <nav className="nav-card">
        <a className="nav-link" href="/">🏠 Home</a>
        <a className="nav-link active" href="/history">📖 History</a>
        <a className="nav-link" href="/allergens">🥜 Allergens</a>
      </nav>
      {message && <p className="message" role="alert">{message}</p>}
      {loading ? <section className="card"><p>Loading food history...</p></section> : (
        <>
          <section className="card">
            <h2 className="section-title">View</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className={view === "foods" ? "primary-button" : "secondary-button"} onClick={() => setView("foods")}>📚 Food Library</button>
              <button className={view === "history" ? "primary-button" : "secondary-button"} onClick={() => setView("history")}>Complete Food History</button>
            </div>
          </section>
          <section className="card soft">
            <h2 className="section-title">Date Range</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["all", "7", "30"] as Range[]).map(option => (
                <button key={option} className={range === option ? "primary-button" : "secondary-button"} onClick={() => setRange(option)}>
                  {option === "all" ? "All Time" : option === "7" ? "Past 7 Days" : "Past 30 Days"}
                </button>
              ))}
            </div>
          </section>
          {view === "foods" ? (
            <>
              <section className="card">
                <h2 className="section-title">Foods Tried ({summaries.length})</h2>
                <p className="muted">Showing foods eaten in your selected date range. Exposure counts and first dates are all-time totals.</p>
                <label className="label" htmlFor="food-search">Search foods</label>
                <input id="food-search" className="field" placeholder="Search foods Thea has tried" value={search} onChange={e => setSearch(e.target.value)} />
              </section>
              {categories.map(category => {
                const matching = visibleSummaries.filter(s => s.category === category);
                if (matching.length === 0) return null;
                return (
                  <section className="card" key={category}>
                    <h2 className="section-title">{category} ({matching.length})</h2>
                    {matching.map(food => (
                      <div key={food.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
                        <button type="button" className="secondary-button" style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 12 }} onClick={() => setExpandedId(current => current === food.id ? null : food.id)} aria-expanded={expandedId === food.id}>
                          <span><strong>{food.name}</strong> · {food.count} {food.count === 1 ? "exposure" : "exposures"}</span>
                          <span>{expandedId === food.id ? "−" : "+"}</span>
                        </button>
                        {expandedId === food.id && (
                          <div style={{ padding: "10px 8px 0" }}>
                            <p>First tried: <strong>{formatDate(food.first)}</strong></p>
                            <p>Most recent: <strong>{formatDate(food.last)}</strong></p>
                            <p>Latest preference: <strong>{preferenceLabel(food.preference)}</strong></p>
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                );
              })}
              {visibleSummaries.length === 0 && <section className="card"><p className="muted">No foods match your search or date range.</p></section>}
            </>
          ) : (
            filtered.length === 0 ? <section className="card"><p>No food exposures in this date range.</p></section> :
              filtered.map(exposure => (
                <section className="card" key={exposure.id} style={{ position: "relative" }}>
                  {!isGuest && <button type="button" onClick={() => void deleteExposure(exposure)} disabled={deletingId === exposure.id} title="Delete" aria-label={`Delete ${foodMap.get(exposure.food_id)?.name ?? "food exposure"}`} style={{ position: "absolute", top: 16, right: 16, border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>🗑️</button>}
                  <h2 className="section-title" style={{ paddingRight: 40 }}>{foodMap.get(exposure.food_id)?.name ?? "Unknown food"}</h2>
                  <p><strong>{formatDate(exposure.eaten_at)}</strong></p>
                  {exposure.preference && <p>Preference: <strong>{preferenceLabel(exposure.preference)}</strong></p>}
                  <p className="muted">Recorded by: <strong>{exposure.recorded_by ? memberMap.get(exposure.recorded_by) ?? "Unknown" : "Unknown"}</strong></p>
                  {exposure.notes && <p className="muted">{exposure.notes}</p>}
                </section>
              ))
          )}
        </>
      )}
    </main>
  );
}
