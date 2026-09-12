import { Reveal } from "@/components/Reveal";
import { LandingActions } from "@/components/LandingActions";
import { NeonCanvas } from "@/components/NeonCanvas";

const TICKER = [
  "one stroke",
  "one board",
  "one link",
  "live together",
  "no refresh",
  "no waiting",
];

const features = [
  {
    label: "realtime",
    title: "At the speed of thought",
    desc: "Every stroke lands on the shared board as it happens — no refresh, no waiting.",
    glyph: <SignalIcon />,
  },
  {
    label: "shared rooms",
    title: "One link. Many hands.",
    desc: "Create a canvas and share its link. Anyone who enters draws on the same live board.",
    glyph: <LinkIcon />,
  },
  {
    label: "export",
    title: "Keep what you made",
    desc: "Take the finished board with you as a PNG or SVG when the session is complete.",
    glyph: <ExportIcon />,
  },
];

const stats = [
  { value: "0ms", label: "sync latency", note: "event → canvas" },
  { value: "∞", label: "live strokes", note: "no cap, ever" },
  { value: "1", label: "link to share", note: "many hands" },
  { value: "2", label: "export formats", note: "png + svg" },
];

const steps = [
  {
    n: "01",
    cmd: "$ neodraw board --new",
    title: "Boot the board",
    desc: "Create a canvas — it opens as an empty neon board, instantly shareable and saved to its room.",
  },
  {
    n: "02",
    cmd: "$ neodraw share --link",
    title: "Hand out the link",
    desc: "Share the one link. Everyone who enters sees the same cursors, the same strokes, the same board.",
  },
  {
    n: "03",
    cmd: "$ neodraw draw --live",
    title: "Sketch together",
    desc: "Draw shapes, freehand lines and text in real time. Every change syncs through the event bus — no polling, no waiting.",
  },
];

export default function LandingPage() {
  return (
    <main className="vw-page overflow-x-hidden">
      <div className="vw-scanlines" aria-hidden="true" />

      {/* ================= HERO ================= */}
      <section className="relative flex min-h-svh items-center overflow-hidden">
        <div className="vw-sun right-[-240px] top-[-180px] lg:right-[-140px]" aria-hidden="true" />
        <div className="vw-grid" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col-reverse items-center gap-14 px-5 pb-24 pt-28 sm:pt-32 lg:flex-row lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <span className="vw-eyebrow calm-fade" style={{ animationDelay: "0.15s" }}>
              neodraw.exe — realtime canvas
            </span>
            <h1 className="mt-6 font-display font-black uppercase leading-[0.95] calm-fade" style={{ animationDelay: "0.35s" }}>
              <span className="block bg-gradient-to-r from-[#FF9900] via-[#FF00FF] to-[#00FFFF] bg-clip-text text-[clamp(2.6rem,7vw,4.75rem)] text-transparent [text-shadow:0_0_44px_rgba(255,0,255,0.35)]">
                One link.
              </span>
              <span className="mt-2 block text-[clamp(2.6rem,7vw,4.75rem)] text-white [text-shadow:0_0_32px_rgba(255,255,255,0.35)]">
                Many strokes.
              </span>
              <span className="mt-2 block text-[clamp(2.6rem,7vw,4.75rem)] text-[#00FFFF] [text-shadow:0_0_36px_rgba(0,255,255,0.7)]">
                All live.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-[46ch] font-mono text-base leading-relaxed text-chrome/75 calm-fade sm:text-lg lg:mx-0" style={{ animationDelay: "0.6s" }}>
              NeoDraw is a real-time collaborative whiteboard drawn in a synthetic neon grid.
              Open a canvas, share the link — every stroke lands on the same board, live, together.
            </p>
            <div className="mt-10 flex justify-center calm-fade lg:justify-start" style={{ animationDelay: "0.8s" }}>
              <LandingActions />
            </div>
            <p className="mt-8 font-mono text-xs uppercase tracking-[0.22em] text-chrome/50 calm-fade" style={{ animationDelay: "1s" }}>
              [ ok ] online · sync &lt; 16ms · peers ∞
            </p>
          </div>

          <div className="w-full max-w-md lg:max-w-lg" style={{ animationDelay: "0.5s" }}>
            <div className="calm-fade">
              <NeonCanvas />
            </div>
          </div>
        </div>
      </section>

      {/* ================= TICKER STRIP ================= */}
      <Reveal>
        <div className="vw-marquee border-y-2 border-[#FF00FF]/40 bg-[#0f0324] py-3">
          <div className="vw-marquee-track font-mono text-sm uppercase tracking-[0.3em] text-[#00FFFF]">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex items-center" aria-hidden={copy === 1}>
                {TICKER.map((t) => (
                  <span key={t} className="mx-7 flex items-center gap-14">
                    {t}
                    <span className="text-[#FF00FF]">◆</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ================= FEATURES ================= */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="vw-dots" aria-hidden="true" />
        <div className="vw-sun bottom-[-200px] left-[-220px] opacity-20" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="vw-window">
              <div className="vw-titlebar">
                <span className="vw-dot" style={{ background: "#FF00FF" }} />
                <span className="vw-dot" style={{ background: "#00FFFF" }} />
                <span className="vw-dot" style={{ background: "#FF9900" }} />
                <span className="mx-1">what_is_neodraw.exe</span>
                <span className="ml-auto hidden sm:inline">--about</span>
              </div>
              <div className="p-6 sm:p-10">
                <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
                  <span className="vw-eyebrow">&gt; system_query — about</span>
                  <h2 className="max-w-md font-display text-3xl font-black uppercase leading-tight text-white [text-shadow:0_0_24px_rgba(255,255,255,0.3)] sm:text-4xl">
                    What is{" "}
                    <span className="text-[#00FFFF] [text-shadow:0_0_18px_rgba(0,255,255,0.8)]">NeoDraw?</span>
                  </h2>
                </div>
                <p className="mt-6 max-w-2xl font-mono text-sm leading-relaxed text-chrome/70 sm:text-base">
                  NeoDraw is a collaborative whiteboard that asks for nothing but a steady hand.
                  Open a canvas, share the link, and everyone draws in the same space — live,
                  together, on one board.
                </p>

                <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
                  {features.map((f, i) => (
                    <Reveal key={f.label} className={`h-full vw-delay-${i + 1}`}>
                      <article className="flex h-full flex-col border border-[#FF00FF]/25 border-t-2 border-t-[#00FFFF] bg-glass/70 p-6 backdrop-blur-md transition-all duration-200 ease-linear hover:-translate-y-2 hover:border-[#00FFFF]/60 hover:shadow-glow-cyan-lg">
                        <div className="vw-diamond">{f.glyph}</div>
                        <span className="mt-6 font-mono text-xs uppercase tracking-[0.28em] text-[#FF00FF]">
                          &gt; {f.label}
                        </span>
                        <h3 className="mt-3 font-display text-2xl font-bold text-[#00FFFF] [text-shadow:0_0_10px_rgba(0,255,255,0.6)]">
                          {f.title}
                        </h3>
                        <p className="mt-3 font-mono text-sm leading-relaxed text-chrome/65">{f.desc}</p>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="relative border-y border-neon bg-[#0a0216] py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 text-center sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} className={`vw-delay-${i + 1}`}>
              <div className="group transition-transform duration-200 ease-linear hover:-translate-y-1">
                <div className="font-display text-5xl font-black sm:text-6xl">
                  <span className="bg-gradient-to-r from-[#FF9900] via-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent [text-shadow:0_0_44px_rgba(255,0,255,0.4)]">
                    {s.value}
                  </span>
                </div>
                <div className="mt-3 font-mono text-sm uppercase tracking-[0.24em] text-[#00FFFF] [text-shadow:0_0_10px_rgba(0,255,255,0.6)]">
                  {s.label}
                </div>
                <div className="mt-1 font-mono text-xs text-chrome/50">{s.note}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="vw-sun right-[-180px] top-[8%] opacity-25" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-5xl px-5">
          <Reveal>
            <span className="vw-eyebrow">&gt; how_it_works.sh</span>
            <h2 className="mt-4 font-display text-3xl font-black uppercase leading-tight text-white [text-shadow:0_0_24px_rgba(255,255,255,0.3)] sm:text-4xl">
              How the grid{" "}
              <span className="text-[#FF00FF] [text-shadow:0_0_18px_rgba(255,0,255,0.8)]">boots up</span>
            </h2>
          </Reveal>

          <div className="relative mt-16 space-y-12">
            <div
              className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-[#FF00FF] via-[#00FFFF] to-transparent lg:left-1/2"
              aria-hidden="true"
            />
            {steps.map((s, i) => {
              const alignRight = i % 2 === 1;
              return (
                <Reveal key={s.n} className={`vw-delay-${(i % 3) + 1}`}>
                  <div className="relative pl-16 lg:pl-0">
                    <span className="absolute left-6 top-1 -translate-x-1/2 lg:left-1/2">
                      <span className="relative block h-10 w-10">
                        <span className="absolute inset-0 rotate-45 border-2 border-[#00FFFF] bg-[#0a0216] shadow-glow-cyan transition-transform duration-200 ease-linear hover:rotate-[135deg]" />
                        <span className="absolute inset-0 grid place-items-center font-display text-xs font-bold text-[#FF00FF] [text-shadow:0_0_10px_rgba(255,0,255,0.8)]">
                          {s.n}
                        </span>
                      </span>
                    </span>
                    <div className={`lg:w-1/2 ${alignRight ? "lg:ml-auto lg:pl-16" : "lg:pr-16"}`}>
                      <div className="border border-[#FF00FF]/25 border-t-2 border-t-[#00FFFF] bg-glass/70 p-6 backdrop-blur-md transition-all duration-200 ease-linear hover:-translate-y-1 hover:shadow-glow-cyan-lg">
                        <span className="font-mono text-xs text-[#00FFFF]">{s.cmd}</span>
                        <h3 className="mt-3 font-display text-xl font-bold text-white [text-shadow:0_0_14px_rgba(255,255,255,0.35)]">
                          {s.title}
                        </h3>
                        <p className="mt-3 font-mono text-sm leading-relaxed text-chrome/65">{s.desc}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.14),transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto max-w-4xl px-5">
          <Reveal>
            <div className="vw-window">
              <div className="vw-titlebar">
                <span className="vw-dot" style={{ background: "#FF00FF" }} />
                <span className="vw-dot" style={{ background: "#00FFFF" }} />
                <span className="vw-dot" style={{ background: "#FF9900" }} />
                <span className="mx-1">neodraw --join</span>
                <span className="ml-auto hidden sm:inline">ctrl+c to exit</span>
              </div>
              <div className="p-8 text-center sm:p-12">
                <span className="vw-eyebrow">&gt; final_transmission</span>
                <h2 className="mt-5 font-display text-4xl font-black uppercase leading-tight sm:text-6xl">
                  <span className="bg-gradient-to-r from-[#FF9900] via-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent [text-shadow:0_0_44px_rgba(255,0,255,0.4)]">
                    Begin the broadcast.
                  </span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl font-mono text-sm leading-relaxed text-chrome/70 sm:text-base">
                  Open a board, share the link, and let every cursor hit the same canvas — in real
                  time, on one neon grid.
                </p>
                <div className="mt-10 flex justify-center">
                  <LandingActions />
                </div>
                <p className="mt-10 inline-flex items-center font-mono text-xs text-chrome/60">
                  <span className="text-[#FF00FF]">$</span>&nbsp; neodraw join --room&nbsp;
                  <span className="text-[#00FFFF]">your-link</span>
                  <span className="vw-cursor" />
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t-2 border-[#FF00FF]/40 bg-[#070010] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-center font-mono text-[0.68rem] uppercase tracking-[0.24em] text-chrome/50 sm:flex-row sm:text-left">
          <span>© MMXXVI NeoDraw</span>
          <span className="text-[#00FFFF]/70">one stroke · one board</span>
          <span>
            [ <span className="text-[#00FFFF]">system: online</span> ]
          </span>
        </div>
      </footer>
    </main>
  );
}

function SignalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00FFFF" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20v-6" />
      <path d="M10 20V8" style={{ animation: "vwPulse 1.6s ease-in-out infinite" }} />
      <path d="M16 20v-4" />
      <path d="M20 20V4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}