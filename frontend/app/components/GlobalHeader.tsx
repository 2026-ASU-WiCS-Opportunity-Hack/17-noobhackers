"use client";

/**
 * Global header — shows logged-in user info in navbar.
 * Hides itself on chapter pages (/{chapter}/*) where the chapter
 * layout provides its own navigation.
 */

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import WialLogo from "./WialLogo";

/** Known top-level routes that are NOT chapter slugs */
const NON_CHAPTER_ROUTES = new Set([
  "about", "certification", "coaches", "resources", "events", "contact",
  "login", "profile", "admin", "chapter-admin", "become-affiliate", "renew",
  "my-learning", "pay", "onboard",
]);

function isChapterPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  return !NON_CHAPTER_ROUTES.has(segments[0]);
}

const NAV_LINKS = [
  { href: "/about", label: "Action Learning" },
  { href: "/certification", label: "Certification" },
  { href: "/coaches", label: "Coaches" },
  { href: "/resources", label: "Resources" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

const ROLE_LABELS: Record<string, string> = {
  Super_Admin: "Admin",
  Chapter_Lead: "Chapter Lead",
  Content_Creator: "Editor",
  Coach: "Coach",
};

const ROLE_COLORS: Record<string, string> = {
  Super_Admin: "bg-wial-red text-white",
  Chapter_Lead: "bg-wial-gold text-wial-gray-900",
  Content_Creator: "bg-wial-info text-white",
  Coach: "bg-cert-palc text-white",
};

export default function GlobalHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Hide global header on chapter pages — chapter layout has its own nav
  if (isChapterPath(pathname)) return null;

  const dashboardLink = user?.role === "Super_Admin"
    ? "/admin/dashboard"
    : user?.role === "Chapter_Lead"
    ? "/chapter-admin/dashboard"
    : user?.role === "Coach"
    ? "/profile"
    : "/admin/dashboard";

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className="h-1 w-full bg-wial-red" />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <WialLogo height={36} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-[13px] font-medium uppercase tracking-wide text-wial-gray-600 hover:text-wial-red"
            >
              {l.label}
            </Link>
          ))}

          {isAuthenticated && user ? (
            <div className="ml-3 flex items-center gap-2">
              {user.role === "Coach" && (
                <Link href="/renew" className="rounded-lg bg-wial-red/10 px-3 py-1.5 text-[12px] font-semibold text-wial-red hover:bg-wial-red/20">
                  Renew Membership
                </Link>
              )}
              <Link
                href={dashboardLink}
                className="flex items-center gap-2 rounded-lg bg-wial-gray-50 px-3 py-1.5 hover:bg-wial-gray-100"
              >
                {/* User avatar */}
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wial-red text-[10px] font-bold text-white">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-wial-gray-900 leading-tight">{user.email}</p>
                  <span className={`inline-block rounded px-1.5 py-0 text-[10px] font-bold ${ROLE_COLORS[user.role] ?? "bg-wial-gray-200 text-wial-gray-700"}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
              </Link>
              <button
                onClick={logout}
                className="rounded bg-wial-gray-100 px-2.5 py-1.5 text-[12px] font-medium text-wial-gray-600 hover:bg-wial-gray-200"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-3 rounded bg-wial-red px-4 py-1.5 text-[13px] font-medium uppercase tracking-wide text-white hover:bg-wial-red-light"
            >
              Login
            </Link>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded text-wial-gray-600 hover:bg-wial-gray-100 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menu"
        >
          {open ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-wial-gray-100 bg-white px-4 pb-4 pt-2 lg:hidden">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium text-wial-gray-700 hover:text-wial-red">
              {l.label}
            </Link>
          ))}
          <div className="my-2 border-t border-wial-gray-100" />

          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-2 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wial-red text-xs font-bold text-white">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-wial-gray-900">{user.email}</p>
                  <span className={`inline-block rounded px-1.5 py-0 text-[10px] font-bold ${ROLE_COLORS[user.role] ?? "bg-wial-gray-200"}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
              </div>
              <Link href={dashboardLink} onClick={() => setOpen(false)} className="block py-2.5 text-sm font-medium text-wial-red">
                Dashboard
              </Link>
              <button onClick={() => { logout(); setOpen(false); }} className="block w-full py-2.5 text-left text-sm font-medium text-wial-gray-700">
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="block rounded bg-wial-red py-2.5 text-center text-sm font-medium text-white">
              Login
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
