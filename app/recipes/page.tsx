"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Recipe = { id: string; household_id: string; name: string; description: string | null };
type Ingredient = { recipe_id: string; food_id: string };
type Food = { id: string; name: string; show_in_dropdown: boolean };
type Alias = { food_id: string; alias: string };
type Preference = "" | "loved" | "liked" | "neutral" | "disliked";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RecipesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [guest, setGuest] = useState(true);
  const [householdId, setHouseholdId] = useState("");
  const [babyId, setBabyId] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [date, setDate] = useState(localDate());
  const [preference, setPreference] = useState<Preference>("");
  const [notes, setNotes] = useState("");

  async function refreshRecipes(currentHouseholdId: string) {
    const [recipeResult, ingredientResult] = await Promise.all([
      supabase.from("recipes").select("id, household_id, name, description")
        .eq("household_id", currentHouseholdId).order("name"),
      supabase.from("recipe_ingredients").select("recipe_id, food_id"),
    ]);
    const error = recipeResult.error ?? ingredientResult.error;
    if (error) throw error;
    const currentRecipes = (recipeResult.data ?? []) as Recipe[];
    const allowed = new Set(currentRecipes.map(r => r.id));
    setRecipes(currentRecipes);
    setIngredients(((ingredientResult.data ?? []) as Ingredient[]).filter(i => allowed.has(i.recipe_id)));
  }

  useEffect(() => {
    async function load() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) throw new Error("Sign in on the Home page first.");
        const { data: member, error: memberError } = await supabase
          .from("household_members").select("household_id, role")
          .eq("user_id", session.user.id).limit(1).maybeSingle();
        if (memberError || !member) throw new Error(memberError?.message ?? "No household membership found.");
        const [babyResult, foodResult, aliasResult] = await Promise.all([
          supabase.from("babies").select("id").eq("household_id", member.household_id).limit(1).maybeSingle(),
          supabase.from("foods").select("id, name, show_in_dropdown").order("name"),
          supabase.from("food_aliases").select("food_id, alias"),
        ]);
        const err = babyResult.error ?? foodResult.error ?? aliasResult.error;
        if (err) throw err;
        if (!babyResult.data?.id) throw new Error("No baby record found for this household.");
        setHouseholdId(member.household_id);
        setBabyId(babyResult.data.id);
        setGuest(member.role === "guest");
        setFoods((foodResult.data ?? []) as Food[]);
        setAliases((aliasResult.data ?? []) as Alias[]);
        await refreshRecipes(member.household_id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load recipes.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const foodMap = useMemo(() => new Map(foods.map(f => [f.id, f.name])), [foods]);
  const aliasMap = useMemo(() => {
    const result = new Map<string, string[]>();
    aliases.forEach(a => result.set(a.food_id, [...(result.get(a.food_id) ?? []), a.alias]));
    return result;
  }, [aliases]);
  const visibleRecipes = useMemo(() => recipes.filter(r =>
    `${r.name} ${r.description ?? ""}`.toLowerCase().includes(search.toLowerCase().trim())), [recipes, search]);
  const availableFoods = useMemo(() => foods.filter(f =>
    f.show_in_dropdown && !chosen.includes(f.id) &&
    (f.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase()) ||
     (aliasMap.get(f.id) ?? []).some(a => a.toLowerCase().includes(ingredientSearch.trim().toLowerCase())))
  ).slice(0, 35), [foods, aliasMap, chosen, ingredientSearch]);

  function resetEditor() {
    setEditingId(null);
    setName("");
    setDescription("");
    setChosen([]);
    setIngredientSearch("");
  }
  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setName(recipe.name);
    setDescription(recipe.description ?? "");
    setChosen(ingredients.filter(i => i.recipe_id === recipe.id).map(i => i.food_id));
    setIngredientSearch("");
    setMessage("");
  }

  async function saveRecipe() {
    setSaveFeedback("");
    setMessage("");
    if (busy) return;
    if (guest) {
      setSaveFeedback("Guests cannot save recipes. Sign in with a household member account.");
      return;
    }
    if (!householdId) {
      setSaveFeedback("Your household has not loaded. Refresh the page and sign in again.");
      return;
    }
    if (!name.trim()) {
      setSaveFeedback("Enter a recipe name before saving.");
      return;
    }
    if (chosen.length === 0) {
      setSaveFeedback("Select at least one ingredient using the + buttons below the search box.");
      return;
    }
    setBusy(true);
    setSaveFeedback("Saving recipe...");
    try {
      const { data, error } = await supabase.rpc("save_recipe", {
        p_household_id: householdId,
        p_recipe_id: editingId,
        p_name: name.trim(),
        p_description: description.trim() || "",
        p_food_ids: [...new Set(chosen)],
      });
      if (error) throw error;
      if (!data) throw new Error("The database did not return a recipe ID.");
      await refreshRecipes(householdId);
      resetEditor();
      setSaveFeedback("Recipe saved! Find it under Saved Recipes below.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setSaveFeedback(`Could not save recipe: ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecipe(recipe: Recipe) {
    if (guest || !window.confirm(`Delete saved recipe “${recipe.name}”? Past food exposures will stay.`)) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) setMessage(error.message);
    else {
      await refreshRecipes(householdId);
      if (editingId === recipe.id) resetEditor();
      setMessage("Recipe deleted. Past exposures were preserved.");
    }
    setBusy(false);
  }

  async function logRecipe() {
    if (!loggingId || guest || !babyId) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("log_recipe", {
        p_recipe_id: loggingId,
        p_baby_id: babyId,
        p_eaten_at: date,
        p_preference: preference || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      setLoggingId(null);
      setPreference("");
      setNotes("");
      setMessage(`${data} ingredient${data === 1 ? "" : "s"} recorded in Thea's food history.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not log recipe.");
    } finally { setBusy(false); }
  }

  return (
    <main className="app-shell">
      <h1 className="page-title">🍽️ Thea&apos;s Recipes</h1>
      <p className="page-subtitle">Save a recipe once, then log each ingredient with one tap.</p>
      <nav className="nav-card">
        <a href="/" className="nav-link">🏠 Home</a>
        <a href="/history" className="nav-link">📖 History</a>
        <a href="/allergens" className="nav-link">🥜 Allergens</a>
        <a href="/recipes" className="nav-link active">🍽️ Recipes</a>
      </nav>
      {message && <p className="message" role="status">{message}</p>}
      {loading ? <section className="card"><p>Loading recipes...</p></section> : (
        <>
          {guest && <section className="card soft"><p>Guest access is read-only. You can browse recipes but not save or log them.</p></section>}
          {!guest && (
            <section className="card">
              <h2 className="section-title">{editingId ? "Edit Recipe" : "Create a Recipe"}</h2>
              <label className="label" htmlFor="recipe-name">Recipe name</label>
              <input id="recipe-name" className="field" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="Sweet Potato Pancakes" />
              <label className="label" htmlFor="recipe-desc" style={{ marginTop: 14 }}>Description (optional)</label>
              <textarea id="recipe-desc" className="textarea-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about the recipe" />
              <h3>Ingredients ({chosen.length})</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {chosen.map(id => <button key={id} type="button" className="secondary-button" onClick={() => setChosen(old => old.filter(x => x !== id))} title="Remove ingredient">{foodMap.get(id) ?? "Unknown"} ×</button>)}
              </div>
              <label className="label" htmlFor="ingredient-search">Find an ingredient</label>
              <input id="ingredient-search" className="field" value={ingredientSearch} onChange={e => setIngredientSearch(e.target.value)} placeholder="Search foods or aliases" />
              <div style={{ maxHeight: 190, overflowY: "auto", margin: "10px 0 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {availableFoods.map(f => <button type="button" className="secondary-button" key={f.id} onClick={() => { setChosen(old => [...old, f.id]); setIngredientSearch(""); }}>+ {f.name}</button>)}
                {availableFoods.length === 0 && <p className="muted">No matching food in the visible catalog.</p>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="primary-button" disabled={busy} onClick={() => void saveRecipe()}>{busy ? "Saving..." : editingId ? "Save Changes" : "Save Recipe"}</button>
                {editingId && <button className="secondary-button" onClick={resetEditor}>Cancel</button>}
              </div>
              {saveFeedback && (
                <p role="status" aria-live="polite" className="message" style={{ marginTop: 14 }}>
                  {saveFeedback}
                </p>
              )}
            </section>
          )}
          <section className="card">
            <h2 className="section-title">Saved Recipes ({recipes.length})</h2>
            <label className="label" htmlFor="recipe-search">Search recipes</label>
            <input className="field" id="recipe-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a recipe" />
            {visibleRecipes.length === 0 && <p className="muted">No saved recipes match your search.</p>}
            {visibleRecipes.map(recipe => {
              const foodIds = ingredients.filter(i => i.recipe_id === recipe.id).map(i => i.food_id);
              return <div key={recipe.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ margin: "0 0 8px" }}>{recipe.name}</h3>
                {recipe.description && <p className="muted">{recipe.description}</p>}
                <p>{foodIds.map(id => foodMap.get(id) ?? "Unknown").join(" · ") || "No ingredients yet"}</p>
                {!guest && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="primary-button" disabled={busy || foodIds.length === 0} onClick={() => { setLoggingId(recipe.id); setDate(localDate()); setPreference(""); setNotes(""); }}>Log Recipe</button>
                  <button className="secondary-button" disabled={busy} onClick={() => startEdit(recipe)}>Edit</button>
                  <button className="secondary-button" disabled={busy} onClick={() => void deleteRecipe(recipe)}>Delete</button>
                </div>}
              </div>;
            })}
          </section>
          {!guest && loggingId && (
            <section className="card soft">
              <h2 className="section-title">Log {recipes.find(r => r.id === loggingId)?.name}</h2>
              <p className="muted">Every ingredient will be recorded separately, once for this recipe entry.</p>
              <label className="label" htmlFor="log-date">Date</label>
              <input id="log-date" type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
              <label className="label" htmlFor="log-preference" style={{ marginTop: 12 }}>Preference (applies to all ingredients)</label>
              <select className="select-field" id="log-preference" value={preference} onChange={e => setPreference(e.target.value as Preference)}>
                <option value="">Not recorded</option><option value="loved">Loved</option><option value="liked">Liked</option><option value="neutral">Neutral</option><option value="disliked">Didn&apos;t like</option>
              </select>
              <label className="label" htmlFor="log-notes">Notes (optional)</label>
              <textarea className="textarea-field" id="log-notes" value={notes} onChange={e => setNotes(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button className="primary-button" disabled={busy || !date} onClick={() => void logRecipe()}>{busy ? "Recording..." : "Confirm & Log Ingredients"}</button>
                <button className="secondary-button" disabled={busy} onClick={() => setLoggingId(null)}>Cancel</button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
