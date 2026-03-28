"use client";

/**
 * Global header — red & white theme matching wial.org branding.
 * Red top accent bar, WIAL logo, clean navigation.
 */

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import WialLogo from "./WialLogo";

const NAV_LINKS = [
  { href: "/about", label: "Action Learning" },
  { href: "/certification", label: "Certification" },
  { href: "/coaches", label: "Coaches" },
  { href: "/resources", label: "Resources" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export default function GlobalHeader() {
  const { isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      {/* Red accent bar at top */}
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
          {isAuthenticated ? (
            <>
              <Link href="/admin/dashboard" className="ml-2 px-3 py-2 text-[13px] font-medium uppercase tracking-wide text-wial-red">
                Dashboard
              </Link>
              <button onClick={logout} className="ml-1 rounded bg-wial-gray-100 px-3 py-1.5 text-[13px] font-medium text-wial-gray-600 hover:bg-wial-gray-200">
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/login" className="ml-3 rounded bg-wial-red px-4 py-1.5 text-[13px] font-medium uppercase tracking-wide text-white hover:bg-wial-red-light">
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
          {isAuthenticated ? (
            <button onClick={() => { logout(); setOpen(false); }} className="block w-full py-2.5 text-left text-sm font-medium text-wial-gray-700">
              Sign Out
            </button>
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
