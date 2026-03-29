"use client";

/**
 * Chapter layout — two-row navbar with mobile hamburger menu.
 * Row 1: Logo + chapter name + user info
 * Row 2: Public nav links (+ admin links if Chapter Lead)
 * Requirements: 4.1, 4.2, 4.4
 */

import Link from "next/link";
import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import WialLogo from "../components/WialLogo";

const LOCAL_NAV = [
  { path: "", label: "Home" },
  { path: "/coaches", label: "Coaches" },
  { path: "/events", label: "Events" },
  { path: "/team", label: "Team" },
  { path: "/resources", label: "Resources" },
  { path: "/contact", label: "Contact" },
];

const ADMIN_NAV = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/manage-coaches", label: "Manage Coaches" },
  { path: "/content", label: "Content" },
  { path: "/payments", label: "Payments" },
];

const ROLE_LABELS: Record<string, string> = {
  Super_Admin: "Admin", Chapter_Lead: "Chapter Lead",
  Content_Creator: "Editor", Coach: "Coach",
};
const ROLE_COLORS: Record<string, string> = {
  Super_Admin: "bg-wial-red text-white",
  Chapter_Lead: "bg-wial-gold text-wial-gray-900",
  Content_Creator: "bg-wial-info text-white",
  Coach: "bg-cert-palc text-white",
};

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = isAuthenticated && user && (user.role === "Chapter_Lead" || user.role === "Super_Admin");
  const isCoach = isAuthenticated && user && user.role === "Coach";

  const isActive = (path: string) => {
    const full = `/${chapter}${path}`;
    return pathname === full || (path === "" && pathname === `/${chapter}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-wial-red to-wial-red-light" />

        {/* Row 1: Logo + Chapter Name + User */}
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0" title="WIAL Global">
              <WialLogo height={28} />
            </Link>
            <div className="hidden h-5 w-px bg-wial-gray-200 sm:block" />
            <Link href={`/${chapter}`} className="text-sm font-bold text-wial-blue sm:text-base">
              {chapterName}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wial-red text-[10px] font-bold text-white">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[140px]">
                    <p className="truncate text-xs font-semibold text-wial-gray-900">{user.email}</p>
                    <span className={`inline-block rounded-full px-1.5 text-[9px] font-bold ${ROLE_COLORS[user.role] ?? "bg-wial-gray-200"}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </div>
                </div>
                <button onClick={logout} className="rounded-lg border border-wial-gray-200 px-2.5 py-1.5 text-xs font-medium text-wial-gray-600 hover:bg-wial-gray-50">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href={`/${chapter}/login`} className="rounded-lg bg-wial-red px-4 py-1.5 text-xs font-bold text-white hover:bg-wial-red-light">
                Login
              </Link>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-wial-gray-600 hover:bg-wial-gray-100 lg:hidden" aria-label="Menu">
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Navigation links (desktop) */}
        <nav className="hidden border-t border-wial-gray-100 lg:block" aria-label="Chapter navigation">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1 sm:px-6">
            {LOCAL_NAV.map((item) => (
              <Link key={item.path} href={`/${chapter}${item.path}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-wial-red/10 text-wial-red"
                    : "text-wial-gray-600 hover:bg-wial-gray-100 hover:text-wial-gray-900"
                }`}>
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="mx-2 h-4 w-px bg-wial-gray-200" />
                {ADMIN_NAV.map((item) => (
                  <Link key={item.path} href={`/${chapter}${item.path}`}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      isActive(item.path)
                        ? "bg-wial-red text-white"
                        : "text-wial-red hover:bg-wial-red/10"
                    }`}>
                    {item.label}
                  </Link>
                ))}
              </>
            )}

            {isCoach && (
              <>
                <div className="mx-2 h-4 w-px bg-wial-gray-200" />
                <Link href="/profile" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-wial-red hover:bg-wial-red/10">
                  My Profile
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="border-t border-wial-gray-100 bg-white px-4 pb-4 pt-2 lg:hidden">
            {LOCAL_NAV.map((item) => (
              <Link key={item.path} href={`/${chapter}${item.path}`} onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive(item.path) ? "bg-wial-red/10 text-wial-red" : "text-wial-gray-700 hover:bg-wial-gray-50"
                }`}>
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <div className="my-2 border-t border-wial-gray-100" />
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-wial-gray-400">Admin</p>
                {ADMIN_NAV.map((item) => (
                  <Link key={item.path} href={`/${chapter}${item.path}`} onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
                      isActive(item.path) ? "bg-wial-red text-white" : "text-wial-red hover:bg-wial-red/5"
                    }`}>
                    {item.label}
                  </Link>
                ))}
              </>
            )}
            {isCoach && (
              <>
                <div className="my-2 border-t border-wial-gray-100" />
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-wial-red">
                  My Profile
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-wial-gray-100 bg-wial-gray-50 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <Link href="/" className="inline-block"><WialLogo height={20} /></Link>
          <p className="mt-2 text-xs text-wial-gray-500">WIAL {chapterName}</p>
          <p className="mt-0.5 text-[10px] text-wial-gray-400">© {new Date().getFullYear()} World Institute for Action Learning</p>
        </div>
      </footer>
    </div>
  );
}
