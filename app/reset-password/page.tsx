"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function updatePassword() {
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setMessage("Your password has been updated! ✓");
    setSaving(false);
  }

  return (
    <main
      className="app-shell"
      style={{
        maxWidth: "460px",
      }}
    >
      <h1 className="page-title">
        Reset Password
      </h1>

      <p className="page-subtitle">
        Choose a new password for Thea&apos;s Food Tracker.
      </p>

      <section className="card">
        {!success ? (
          <>
            <label className="label">
              New password

              <input
                className="field"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="New password"
                style={{
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              />
            </label>

            <label className="label">
              Confirm new password

              <input
                className="field"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Confirm new password"
                style={{
                  marginTop: "8px",
                  marginBottom: "16px",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "18px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) =>
                  setShowPassword(e.target.checked)
                }
              />
              Show passwords
            </label>

            <button
              className="primary-button"
              onClick={updatePassword}
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : "Update password"}
            </button>
          </>
        ) : (
          <a
            href="/"
            className="primary-button"
            style={{
              display: "inline-block",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Return to Food Tracker
          </a>
        )}

        {message && (
          <p className="message">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
