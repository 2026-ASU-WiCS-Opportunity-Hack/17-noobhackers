"use client";

/**
 * Login page — real Cognito authentication.
 * Email + password form, validates against Cognito user pool.
 */

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";
import WialLogo from "../components/WialLogo";

export default function LoginPage() {
  const { isAuthenticated, isLoading, signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && typeof window !== "undefined") {
      // Chapter Leads and Coaches redirect to their chapter
      if ((user.role === "Chapter_Lead" || user.role === "Coach") && user.assignedChapters.length > 0) {
        const slug = user.assignedChapters[0];
        const dest = user.role === "Chapter_Lead" ? `/${slug}/dashboard` : `/${slug}/coaches`;
        window.location.href = dest;
        return;
      }
      const redirectMap: Record<string, string> = {
        Super_Admin: "/admin/dashboard",
        Chapter_Lead: "/chapter-admin/dashboard",
        Content_Creator: "/chapter-admin/content",
        Coach: "/coaches",
      };
      window.location.href = redirectMap[user.role] ?? "/";
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <div className="flex min-h-[80vh] items-center justify-center"><p className="text-wial-gray-500">Redirecting...</p></div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter both email and password."); return; }

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Authentication failed.");
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col lg:flex-row">
      {/* Left — branding */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-wial-red via-wial-red to-wial-red-light px-8 py-16 text-white lg:py-0">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex items-center justify-center rounded-2xl bg-white/15 p-6 backdrop-blur-sm">
            <WialLogo height={60} className="brightness-0 invert" />
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Welcome to WIAL</h1>
          <p className="mt-4 text-base text-white/80">
            World Institute for Action Learning — empowering coaches
            and organizations across 20+ countries.
          </p>
          <div className="mt-10 flex justify-center gap-10 text-sm text-white/60">
            <div className="text-center"><p className="text-3xl font-bold text-white">20+</p><p className="mt-1">Countries</p></div>
            <div className="text-center"><p className="text-3xl font-bold text-white">250+</p><p className="mt-1">Coaches</p></div>
            <div className="text-center"><p className="text-3xl font-bold text-white">12</p><p className="mt-1">Chapters</p></div>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-16 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-bold text-wial-gray-900">Sign in</h2>
          <p className="mt-2 text-sm text-wial-gray-500">Enter your WIAL credentials</p>

          {error && (
            <div className="mt-4 rounded-xl border border-wial-error/30 bg-wial-error/5 px-4 py-3">
              <p className="text-sm text-wial-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-wial-gray-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@wial.org"
                className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm transition-all focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20"
                autoFocus
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-wial-gray-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm transition-all focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20"
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center rounded-xl bg-wial-red px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-wial-red/25 transition-all hover:bg-wial-red-light hover:shadow-xl hover:shadow-wial-red/30 disabled:opacity-60"
            >
              {submitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-wial-gray-500 transition-colors hover:text-wial-red">
              ← Continue as Guest
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-wial-gray-400">
            Contact your chapter administrator for account access.
          </p>
        </div>
      </div>
    </div>
  );
}
