export function InkEnso() {
  return (
    <div className="enso-stand calm-fade" style={{ animationDelay: "0.3s" }} aria-hidden="true">
      <svg viewBox="0 0 800 700" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          className="enso-ink"
          pathLength={1}
          d="M 400 90
             C 570 96 700 210 692 362
             C 684 524 548 626 384 618
             C 232 610 120 492 128 344
             C 136 196 262 100 402 108
             C 470 112 522 150 554 218
             C 588 286 574 366 522 424"
        />
        <path className="enso-ink enso-trace" pathLength={1} d="M 220 640 h 360" />
        <path className="enso-ink enso-seed" pathLength={1} d="M 574 524 q 12 18 8 40" />
      </svg>
      <span className="enso-caption">One stroke. One board.</span>
    </div>
  );
}