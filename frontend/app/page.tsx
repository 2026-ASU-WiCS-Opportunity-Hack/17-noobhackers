/**
 * Global site landing page — red & white WIAL theme.
 * Inspired by wial.org structure and branding.
 */

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── HERO ── */}
      <section className="relative bg-wial-red px-4 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Action Learning
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            What is Action Learning?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Action Learning is a new way of thinking, doing business, and
            interacting in teams. It helps organizations develop creative,
            flexible and successful strategies to pressing problems.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/about"
              className="w-full rounded bg-white px-8 py-3 text-sm font-bold uppercase tracking-wider text-wial-red hover:bg-wial-gray-100 sm:w-auto"
            >
              Read More
            </Link>
            <Link
              href="/coaches"
              className="w-full rounded border-2 border-white/50 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white hover:border-white hover:bg-white/10 sm:w-auto"
            >
              Find a Coach
            </Link>
          </div>
        </div>
      </section>

      {/* ── SOLUTION SPHERES ── */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-wial-red">
            Solution Spheres
          </p>
          <h2 className="mt-3 text-center text-2xl font-bold text-wial-gray-900 sm:text-3xl">
            How can your organization grow with Action Learning?
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { t: "Leadership Development", d: "Build leaders at every level through real problem solving" },
              { t: "Team Building", d: "Create high-performing teams through collaborative inquiry" },
              { t: "Strategy", d: "Develop creative strategies for complex challenges" },
              { t: "Problem Solving", d: "Tackle urgent problems with proven methods" },
              { t: "Coaching", d: "Certify internal coaches to sustain Action Learning" },
            ].map((s) => (
              <div key={s.t} className="rounded-lg border border-wial-gray-200 p-6 text-center hover:border-wial-red/30 hover:shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-wial-red/10">
                  <div className="h-3 w-3 rounded-full bg-wial-red" />
                </div>
                <h3 className="text-sm font-bold text-wial-gray-900">{s.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-wial-gray-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="bg-wial-gray-50 px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-wial-red">Benefits</p>
            <h2 className="mt-3 text-2xl font-bold text-wial-gray-900 sm:text-3xl">
              Get more out of your organization
            </h2>
            <p className="mt-4 text-base leading-relaxed text-wial-gray-600">
              Action Learning empowers individuals, teams, and organizations.
              See how it can benefit your business.
            </p>
            <Link href="/about" className="mt-6 inline-block text-sm font-bold uppercase tracking-wider text-wial-red hover:text-wial-red-light">
              Learn More →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: "Individuals", d: "Personal growth and leadership" },
              { l: "Teams", d: "Collaboration and problem solving" },
              { l: "Organizations", d: "Strategic alignment and innovation" },
              { l: "Communities", d: "Social impact via Better World Fund" },
            ].map((b) => (
              <div key={b.l} className="rounded-lg bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-wial-red">{b.l}</h3>
                <p className="mt-1 text-xs text-wial-gray-500">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COACH DIRECTORY ── */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-wial-red">People</p>
          <h2 className="mt-3 text-center text-2xl font-bold text-wial-gray-900 sm:text-3xl">
            Search for Action Learning Coaches
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base text-wial-gray-500">
            Find WIAL Certified Coaches with our AI-powered directory
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "Dr. Sarah Chen", l: "Singapore", c: "MALC", bg: "bg-cert-malc" },
              { n: "Carlos Mendes", l: "São Paulo", c: "SALC", bg: "bg-cert-salc" },
              { n: "Emily Thompson", l: "London", c: "PALC", bg: "bg-cert-palc" },
              { n: "Amara Okafor", l: "Lagos", c: "CALC", bg: "bg-cert-calc" },
            ].map((coach) => (
              <div key={coach.n} className="rounded-lg border border-wial-gray-200 p-5 text-center hover:shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-wial-red text-lg font-bold text-white">
                  {coach.n.split(" ").map((w) => w[0]).join("")}
                </div>
                <h3 className="mt-3 text-sm font-bold text-wial-gray-900">{coach.n}</h3>
                <p className="text-xs text-wial-gray-500">{coach.l}</p>
                <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold text-white ${coach.bg}`}>{coach.c}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/coaches" className="inline-block rounded bg-wial-red px-8 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-wial-red-light">
              View Full Directory
            </Link>
          </div>
        </div>
      </section>

      {/* ── CERTIFICATION ── */}
      <section className="bg-wial-red px-4 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Certification</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            WIAL is the world&apos;s leading certifying body for Action Learning
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/80">
            Action Learning will impact the way you work, think, and do business.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { code: "CALC", label: "Certified", border: "border-blue-300" },
              { code: "PALC", label: "Professional", border: "border-emerald-300" },
              { code: "SALC", label: "Senior", border: "border-yellow-300" },
              { code: "MALC", label: "Master", border: "border-violet-300" },
            ].map((c) => (
              <div key={c.code} className={`rounded-lg border-2 ${c.border} bg-white/10 p-5 backdrop-blur-sm`}>
                <p className="text-2xl font-extrabold">{c.code}</p>
                <p className="mt-1 text-xs text-white/70">{c.label}</p>
              </div>
            ))}
          </div>
          <Link href="/certification" className="mt-8 inline-block rounded bg-white px-8 py-3 text-sm font-bold uppercase tracking-wider text-wial-red hover:bg-wial-gray-100">
            Learn About Certification
          </Link>
        </div>
      </section>

      {/* ── 6 COMPONENTS ── */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-wial-gray-900 sm:text-3xl">
            The 6 Components of Action Learning
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: 1, t: "A Problem", d: "Urgent, significant, and the team's responsibility." },
              { n: 2, t: "A Group or Team", d: "4-8 members with diverse backgrounds." },
              { n: 3, t: "Insightful Questions", d: "Questioning and reflective listening." },
              { n: 4, t: "Action Taken", d: "The group acts on the problem." },
              { n: 5, t: "Commitment to Learning", d: "Equal attention to problem and learning." },
              { n: 6, t: "An AL Coach", d: "A certified coach guiding the process." },
            ].map((c) => (
              <div key={c.n} className="flex gap-4 rounded-lg border border-wial-gray-200 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wial-red text-sm font-bold text-white">{c.n}</span>
                <div>
                  <h3 className="text-sm font-bold text-wial-gray-900">{c.t}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-wial-gray-500">{c.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHAPTERS ── */}
      <section className="bg-wial-gray-50 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-wial-red">Global Network</p>
          <h2 className="mt-3 text-center text-2xl font-bold text-wial-gray-900 sm:text-3xl">WIAL Chapters Worldwide</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { n: "USA", s: "usa", f: "🇺🇸" }, { n: "Brazil", s: "brazil", f: "🇧🇷" },
              { n: "United Kingdom", s: "uk", f: "🇬🇧" }, { n: "Singapore", s: "singapore", f: "🇸🇬" },
              { n: "South Africa", s: "south-africa", f: "🇿🇦" }, { n: "Australia", s: "australia", f: "🇦🇺" },
              { n: "Japan", s: "japan", f: "🇯🇵" }, { n: "Germany", s: "germany", f: "🇩🇪" },
            ].map((ch) => (
              <Link key={ch.s} href={`/${ch.s}`} className="flex items-center gap-3 rounded-lg border border-wial-gray-200 bg-white px-4 py-3 text-sm font-medium text-wial-gray-700 hover:border-wial-red hover:text-wial-red">
                <span className="text-lg">{ch.f}</span>{ch.n}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <section className="bg-wial-red px-4 py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Newsletter</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Join Our Newsletter</h2>
          <p className="mt-4 text-base text-white/80">Stay up to date on all things Action Learning.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <input type="email" placeholder="Your email address" className="w-full rounded bg-white/15 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:bg-white/25 focus:outline-none sm:w-72" aria-label="Email" />
            <button className="w-full rounded bg-white px-6 py-3 text-sm font-bold uppercase tracking-wider text-wial-red hover:bg-wial-gray-100 sm:w-auto">Sign Up</button>
          </div>
        </div>
      </section>

      {/* ── EVENTS ── */}
      <section className="bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-wial-gray-900 sm:text-3xl">Upcoming Events</h2>
          <div className="mt-10 space-y-3">
            {[
              { t: "WIAL Global Conference 2026", d: "June 15–17, 2026", l: "Virtual" },
              { t: "CALC Certification Workshop", d: "April 20, 2026", l: "New York, USA" },
              { t: "Action Learning Masterclass", d: "May 5, 2026", l: "London, UK" },
            ].map((e) => (
              <div key={e.t} className="flex flex-col justify-between gap-2 rounded-lg border border-wial-gray-200 px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold text-wial-gray-900">{e.t}</h3>
                  <p className="text-xs text-wial-gray-500">{e.d} · {e.l}</p>
                </div>
                <span className="text-xs font-semibold uppercase text-wial-red">Details →</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/events" className="text-sm font-bold uppercase tracking-wider text-wial-red hover:text-wial-red-light">View All Events →</Link>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="bg-wial-gray-50 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-wial-gray-900 sm:text-3xl">How to Reach Us</h2>
          <p className="mt-4 text-base text-wial-gray-500">Questions about Action Learning, certification, or chapters?</p>
          <a href="mailto:info@wial.org" className="mt-4 inline-block text-lg font-bold text-wial-red hover:text-wial-red-light">info@wial.org</a>
          <p className="mt-2 text-sm text-wial-gray-400">P.O. Box 7601 #83791, Washington, DC 20044</p>
        </div>
      </section>
    </div>
  );
}
