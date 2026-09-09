import Link from "next/link";

const features = [
  {
    icon: "✎",
    title: "Realtime Drawing",
    desc: "Sketch, doodle and diagram with friends instantly. Every stroke syncs across the room in real time.",
  },
  {
    icon: "◇",
    title: "Smart Tools",
    desc: "Rectangles, circles, diamonds, text, freehand pencil and a precision eraser — all at your fingertips.",
  },
  {
    icon: "↔",
    title: "Multiplayer Rooms",
    desc: "Share a link and invite anyone. Draw together on one shared canvas, wherever they are.",
  },
  {
    icon: "⤓",
    title: "Export Your Art",
    desc: "Save your masterpiece as a crisp PNG or scalable SVG — ready to share or drop into any project.",
  },
];

const doodleShapes = [
  { color: "#05CE81", w: 90, h: 60, top: "22%", left: "8%", delay: "0s" },
  { color: "#05CE81", w: 60, h: 60, top: "68%", left: "14%", delay: "1.2s" },
  { color: "#05CE81", w: 70, h: 70, top: "16%", left: "78%", delay: "0.6s" },
  { color: "#05CE81", w: 80, h: 55, top: "72%", left: "82%", delay: "1.8s" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient green glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-brand/10 blur-[120px]" />

      {/* Floating animated doodles */}
      {doodleShapes.map((s, i) =>
        i % 2 === 0 ? (
          <div
            key={i}
            className="pointer-events-none absolute opacity-25"
            style={{
              top: s.top,
              left: s.left,
              border: `2px solid ${s.color}`,
              width: s.w,
              height: s.h,
              borderRadius: "24%",
              animation: `neodrawFloat 7s ease-in-out ${s.delay} infinite`,
            }}
          />
        ) : (
          <div
            key={i}
            className="pointer-events-none absolute opacity-25"
            style={{
              top: s.top,
              left: s.left,
              width: s.w,
              height: s.h,
              transform: "rotate(45deg)",
              border: `2px solid ${s.color}`,
              borderRadius: "10px",
              animation: `neodrawFloat 9s ease-in-out ${s.delay} infinite`,
            }}
          />
        ),
      )}

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-40 pb-24 text-center">
        {/* Badge */}
        <span
          className="mb-6 rounded-full border border-brand/40 bg-brand-soft px-4 py-1.5 text-xs font-semibold tracking-wide text-brand"
          style={{ animation: "neodrawFadeUp 0.7s ease forwards" }}
        >
          ✦ Real-time collaborative whiteboard
        </span>

        <h1
          className="mb-6 text-5xl font-extrabold tracking-tight sm:text-7xl"
          style={{ animation: "neodrawFadeUp 0.7s 0.1s ease both" }}
        >
          Draw together,
          <span className="block text-brand">live.</span>
        </h1>

        <p
          className="mb-10 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl"
          style={{ animation: "neodrawFadeUp 0.7s 0.2s ease both" }}
        >
          NeoDraw turns any idea into a shared canvas. Sketch, annotate and
          collaborate in real time — invite your team, spin up a room and start
          creating instantly.
        </p>

        {/* CTAs */}
        <div
          className="mb-16 flex flex-col gap-4 sm:flex-row"
          style={{ animation: "neodrawFadeUp 0.7s 0.3s ease both" }}
        >
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-bold text-black shadow-[0_0_40px_rgba(5,206,129,0.35)] transition-all hover:bg-brand-hover hover:shadow-[0_0_60px_rgba(5,206,129,0.55)]"
          >
            Get Started
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:border-brand hover:text-brand"
          >
            Sign In
          </Link>
        </div>

        {/* Live SVG mini-canvas illustration */}
        <div
          className="mb-20 w-full max-w-xl rounded-2xl border border-white/10 bg-surface/60 p-2 shadow-2xl"
          style={{ animation: "neodrawFadeUp 0.8s 0.4s ease both" }}
        >
          <svg viewBox="0 0 600 300" className="w-full rounded-xl bg-paper">
            <g fill="none" stroke="#05CE81" strokeWidth="3" strokeLinecap="round">
              <rect x="90" y="90" width="150" height="100" rx="12" />
              <circle cx="360" cy="140" r="60" />
              <path d="M450 200 L520 100 L570 210 L460 250 Z" strokeWidth="2.5" />
            </g>
            <path
              d="M40 200 C110 140 180 240 250 150 S400 90 470 170 S540 130 590 180"
              fill="none"
              stroke="#05CE81"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="1800"
              style={{ animation: "neodrawDrawLine 3s ease forwards" }}
            />
            <circle cx="250" cy="150" r="6" fill="#05CE81" />
            <circle cx="470" cy="170" r="6" fill="#05CE81" />
          </svg>
        </div>

        {/* Features */}
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/10 bg-surface/60 p-6 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_10px_40px_rgba(5,206,129,0.12)]"
              style={{ animation: `neodrawFadeUp 0.6s ${0.5 + i * 0.1}s ease both` }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                {f.icon}
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div
          className="mt-20 flex flex-col items-center gap-5 rounded-3xl border border-brand/25 bg-gradient-to-b from-brand/10 to-transparent px-10 py-12 text-center"
          style={{ animation: "neodrawFadeUp 0.7s 0.9s ease both" }}
        >
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Ready to start <span className="text-brand">drawing?</span>
          </h2>
          <p className="max-w-md text-muted">
            Create a free account and open your first shared canvas in seconds.
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-bold text-black transition-all hover:bg-brand-hover"
          >
            Create your whiteboard →
          </Link>
        </div>

        <footer className="mt-16 flex w-full items-center justify-center border-t border-white/10 pt-8 text-sm text-muted">
          © {new Date().getFullYear()} NeoDraw — draw together, live.
        </footer>
      </div>
    </main>
  );
}
