"use client";

/**
 * Chapter-specific login page at /{chapter}/login.
 * After login, redirects to the chapter dashboard.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import WialLogo from "../../components/WialLogo";
import Link from "next/link";

export default function ChapterLoginPage() {
  const params = useParams();
  const router = useRouter();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { signIn, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) {
    const dest = user.role === "Chapter_Lead" ? `/${chapter}/dashboard` : `/${chapter}/coaches`;
    router.push(dest);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(email, password);
    if (result.success) {
      router.push(`/${chapter}/dashboard`);
    } else {
      setError(result.error ?? "Login failed.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo + branding */}
        <div className="text-center">
          <Link href={`/${chapter}`} className="inline-block">
            <WialLogo height={56} />
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-wial-gray-900">
            WIAL {chapterName}
          </h1>
          <p className="mt-2 text-base text-wial-gray-500">
            Sign in to your chapter portal
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-wial-error/30 bg-wial-error/5 px-4 py-3">
            <p className="text-sm text-wial-error">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@wial.org"
              autoFocus
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm transition-all focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-wial-gray-700">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-wial-gray-200 bg-wial-gray-50 px-4 py-3 text-sm transition-all focus:border-wial-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-wial-red/20"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-wial-red px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-wial-red/25 transition-all hover:bg-wial-red-light hover:shadow-xl hover:shadow-wial-red/30 disabled:opacity-60"
          >
            {loading ? (
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href={`/${chapter}`} className="text-sm text-wial-gray-500 transition-colors hover:text-wial-red">
            ← Back to {chapterName}
          </Link>
        </div>
      </div>
    </div>
  );
}
