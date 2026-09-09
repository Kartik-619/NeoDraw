import { Reveal } from "@/components/Reveal";
import { LandingActions } from "@/components/LandingActions";
import { InkEnso } from "@/components/InkEnso";

const features = [
  {
    label: "Realtime",
    title: "Drawing at the speed of thought",
    desc: "Every stroke lands on the shared board as it happens — no refresh, no waiting.",
  },
  {
    label: "Shared rooms",
    title: "One link. Many hands.",
    desc: "Create a canvas and share its link. Anyone who enters draws on the same live board.",
  },
  {
    label: "Export",
    title: "Keep what you made",
    desc: "Take the finished board with you as a PNG or SVG when the session is complete.",
  },
];

export default function LandingPage() {
  return (
    <main className="themed-landing serenity">
      <section className="hero">
        <div className="hero-wrap">
          <div className="hero-copy">
            <span className="hero-eyebrow calm-fade" style={{ animationDelay: "0.1s" }}>
              NeoDraw · Real-time collaborative whiteboard
            </span>
            <h1 className="hero-title calm-fade" style={{ animationDelay: "0.35s" }}>
              Sketch together, live.
            </h1>
            <div className="hero-rule mt-9 calm-fade" style={{ animationDelay: "0.6s" }} aria-hidden="true" />
            <p className="hero-sub mt-7 calm-fade" style={{ animationDelay: "0.75s" }}>
              A quiet, real-time whiteboard for shared ideas. Draw, annotate, and
              build on one living canvas with the people you trust.
            </p>
            <div className="mt-11 calm-fade" style={{ animationDelay: "0.95s" }}>
              <LandingActions />
            </div>
          </div>

          <InkEnso />
        </div>
      </section>

      <section className="stone-section">
        <div className="mx-auto w-full max-w-5xl">
          <Reveal>
            <div className="stone-section-header">
              <h2>What is NeoDraw?</h2>
              <p>
                NeoDraw is a collaborative whiteboard that asks for nothing but a
                steady hand. Open a canvas, share the link, and everyone draws in
                the same space — live, together, on one board.
              </p>
            </div>
          </Reveal>

          <div className="stone-features">
            {features.map((f) => (
              <Reveal key={f.label} className="stone-feature">
                <span className="stone-feature-label">{f.label}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="stone-footer">
              <span>© MMXXVI NeoDraw</span>
              <span>One stroke. One board.</span>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}