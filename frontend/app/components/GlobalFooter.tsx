"use client";

/**
 * Global footer — red accent, matches wial.org structure.
 * Hides on chapter pages where the chapter layout provides its own footer.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const NON_CHAPTER_ROUTES = new Set([
  "about", "certification", "coaches", "resources", "events", "contact",
  "login", "profile", "admin", "chapter-admin", "become-affiliate", "renew",
  "my-learning", "pay", "onboard",
]);

export default function GlobalFooter() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isChapter = segments.length > 0 && !NON_CHAPTER_ROUTES.has(segments[0]);

  if (isChapter) return null;
  return (
    <footer className="w-full bg-wial-gray-900 text-wial-gray-400">
      {/* Red accent bar */}
      <div className="h-1 w-full bg-wial-red" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xl font-extrabold text-white">WIAL</span>
            <p className="mt-4 text-sm leading-relaxed">
              World Institute for Action Learning<br />
              P.O. Box 7601 #83791<br />
              Washington, DC 20044
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              {["Twitter", "LinkedIn", "Facebook", "YouTube"].map((s) => (
                <a key={s} href="#" className="text-wial-gray-500 hover:text-white">{s}</a>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-wial-gray-300">Action Learning</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white">What is Action Learning?</Link></li>
              <li><Link href="/about" className="hover:text-white">Benefits</Link></li>
              <li><Link href="/about" className="hover:text-white">Solution Spheres</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-wial-gray-300">People</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/coaches" className="hover:text-white">Coach Directory</Link></li>
              <li><Link href="/certification" className="hover:text-white">Certification</Link></li>
              <li><Link href="/events" className="hover:text-white">Events</Link></li>
              <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-wial-gray-300">Chapters</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/usa" className="hover:text-white">USA</Link></li>
              <li><Link href="/brazil" className="hover:text-white">Brazil</Link></li>
              <li><Link href="/uk" className="hover:text-white">United Kingdom</Link></li>
              <li><Link href="/singapore" className="hover:text-white">Singapore</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-wial-gray-800 pt-6 text-center text-xs">
          <p>© {new Date().getFullYear()} WIAL | <Link href="/privacy" className="hover:text-white">Privacy Policy</Link></p>
        </div>
      </div>
    </footer>
  );
}
