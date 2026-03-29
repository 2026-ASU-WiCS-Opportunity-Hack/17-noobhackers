"use client";

/**
 * Chapter-specific login page at /{chapter}/login.
 * After login, redirects to the chapter admin dashboard.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function ChapterLoginPage() {
  const params = useParams();
  const router = useRouter();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { signIn, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.push("/chapter-admin/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(email, password);
    if (result.success) {
      router.push("/chapter-admin/dashboard");
    } else {
      setError(result.error ?? "Login failed.");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-wial-gray-900">
          WIAL {chapterName}
        </h1>
        <p className="mt-1 text-sm text-wial-gray-500">
          Sign in to manage your chapter
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-wial-error/30 bg-wial-error/5 p-3">
          <p className="text-sm text-wial-error">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-wial-gray-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-wial-gray-200 px-4 py-2.5 text-sm focus:border-wial-red focus:outline-none focus:ring-2 focus:ring-wial-red/20"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-wial-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-wial-red-light disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
