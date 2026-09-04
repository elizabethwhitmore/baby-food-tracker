"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [message, setMessage] = useState("Checking connection...");

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("babies")
        .select("name")
        .limit(1);

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage(`Connected successfully. Found: ${data?.[0]?.name ?? "no baby"}`);
      }
    }

    testConnection();
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Thea's Food Tracker</h1>
      <p>{message}</p>
    </main>
  );
}
