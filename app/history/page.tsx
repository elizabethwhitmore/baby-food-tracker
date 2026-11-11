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

type Food = {
  id: string;
  name: string;
  category: string | null;
};

type HouseholdMember = {
  user_id: string;
  display_name: string | null;
};

type DateRange = "all" | "7" | "30";
type ViewMode = "history" | "foods";

type FoodSummary = {
  id: string;
  name: string;
  category: string;
  count: number;
  firstDate: string;
  lastDate: string;
  latestPreference: string | null;
};

const CATEGORY_ORDER = [
  "Vegetables", "Fruits", "Grains", "Proteins", "Legumes",
  "Dairy", "Dairy Alternatives", "Nuts & Seeds", "Herbs & Spices", "Other",
];

function displayCategory(value: string | null): string {
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

function inDateRange(value: string, range: DateRange): boolean {
  if (range === "all") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - (range === "7" ? 6 : 29));
  const date = new Date(`${value}T00:00:00`);
  return date >= cutoff && date <= today;
}

export default function HistoryPage() {
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("foods");
  const [dateRange, setDateRange] = useState<DateRange>("all");
