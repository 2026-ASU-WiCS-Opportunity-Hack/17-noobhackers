"use client";

/**
 * Login page — red & white WIAL theme, split layout.
 */

import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";
import WialLogo from "../components/WialLogo";

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    if (isAuthenticated && typeof window !== "undefined") window.location.href = "/";
  }, [isAuthenticated]);

  if (isLoading) return <div className="flex min-h-[80vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-wial-gray-200 border-t-wial-red" /></div>;
  if (isAuthenticated) return <div className="flex min-h-[80vh] items-center justify-center"><p className="text-wial-gray-500">Redirecting...</p></div>;

  return (
    <div className="flex min-h-[80vh] flex-col lg:flex-row">
      {/* Left — branding */}
      <div className="flex flex-1 flex-col items-center justify-center bg-wial-red px-8 py-16 text-white lg:py-0">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15">
            <span className="text-3xl font-bold">W</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Welcome to WIAL</h1>
          <p className="mt-4 text-base text-white/80">
            The World Institute for Action Learning — empowering coaches
            and organizations across 20+ countries.
          </p>
          <div className="mt-8 flex justify-center gap-8 text-sm text-white/60">
            <div className="text-center"><p className="text-2xl font-bold text-white">20+</p><p>Countries</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-white">250+</p><p>Coaches</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-white">12</p><p>Chapters</p></div>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center bg-wial-gray-50 px-6 py-16 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-wial-gray-900">Sign in</h2>
          <p className="mt-2 text-sm text-wial-gray-500">Access your WIAL dashboard and management tools.</p>

          <div className="mt-8 space-y-4">
            <button
              onClick={login}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-wial-red px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-wial-red/20 hover:bg-wial-red-light focus:outline-none focus:ring-2 focus:ring-wial-red focus:ring-offset-2 active:scale-[0.98]"
              aria-label="Sign in"
            >
              Sign In with WIAL Account
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-wial-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-wial-gray-50 px-3 text-wial-gray-400">or</span></div>
            </div>

            <Link href="/" className="flex w-full items-center justify-center rounded-lg border-2 border-wial-gray-200 bg-white px-6 py-3 text-sm font-medium text-wial-gray-700 hover:border-wial-gray-300 hover:bg-wial-gray-50">
              Continue as Guest
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-wial-gray-400">
            Access is restricted to authorized WIAL personnel.<br />
            Contact your chapter administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}
