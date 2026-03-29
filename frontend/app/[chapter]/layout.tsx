"use client";

/**
 * Chapter layout — standalone navigation for chapter pages.
 * Replaces the global header/footer with chapter-specific nav.
 * Requirements: 4.1, 4.2, 4.4
 */

import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const chapter = params.chapter as string;
  const chapterName = chapter.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { isAuthenticated, user, logout } = useAuth();

  const dashboardLink = user?.role === "Super_Admin"
    ? "/admin/dashboard"
    : user?.role === "Chapter_Lead"
    ? "/chapter-admin/dashboard"
    : "/profile";

  const isChapterAdmin = isAuthenticated && user &&
    (user.role === "Chapter_Lead" || user.role === "Super_Admin");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Chapter header */}
      <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
        <div className="h-1 w-full bg-wial-red" />
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="shrink-0" title="WIAL Global">
              <WialLogo height={28} />
            </Link>
            <span className="text-sm font-bold text-wial-blue">{chapterName}</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Chapter navigation">
            {LOCAL_NAV.map((item) => (
              <Link
                key={item.path}
                href={`/${chapter}${item.path}`}
                className="rounded-md px-3 py-1.5 text-sm text-wial-gray-600 hover:bg-wial-gray-100 hover:text-wial-gray-900"
              >
                {item.label}
              </Link>
            ))}
            {isChapterAdmin && (
              <>
                <span className="mx-1 text-wial-gray-300">|</span>
                {ADMIN_NAV.map((item) => (
                  <Link
                    key={item.path}
                    href={`/${chapter}${item.path}`}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-wial-red hover:bg-wial-red/5"
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link href={dashboardLink} className="flex items-center gap-2 rounded-lg bg-wial-gray-50 px-2.5 py-1 hover:bg-wial-gray-100">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-wial-red text-[10px] font-bold text-white">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-medium text-wial-gray-900 leading-tight">{user.email}</p>
                    <span className={`inline-block rounded px-1 text-[9px] font-bold ${ROLE_COLORS[user.role] ?? "bg-wial-gray-200"}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </div>
                </Link>
                <button onClick={logout} className="rounded bg-wial-gray-100 px-2 py-1 text-xs font-medium text-wial-gray-600 hover:bg-wial-gray-200">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href={`/${chapter}/login`} className="rounded bg-wial-red px-3 py-1.5 text-xs font-medium text-white hover:bg-wial-red-light">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Compact chapter footer */}
      <footer className="border-t border-wial-gray-200 bg-wial-gray-50 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-wial-gray-500 sm:px-6">
          <p>WIAL {chapterName} · <Link href="/" className="text-wial-red hover:underline">wial.org</Link></p>
          <p className="mt-1">© {new Date().getFullYear()} World Institute for Action Learning</p>
        </div>
      </footer>
    </div>
  );
}
