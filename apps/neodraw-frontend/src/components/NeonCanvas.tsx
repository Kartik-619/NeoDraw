const NEON = {
  magenta: "#FF00FF",
  cyan: "#00FFFF",
  sunset: "#FF9900",
  chrome: "#E0E0E0",
};

export function NeonCanvas() {
  return (
    <div className="vw-window" aria-hidden="true">
      <div className="vw-titlebar">
        <span className="vw-dot" style={{ background: NEON.magenta }} />
        <span className="vw-dot" style={{ background: NEON.cyan }} />
        <span className="vw-dot" style={{ background: NEON.sunset }} />
        <span className="mx-1">board://live.neon</span>
        <span className="ml-auto hidden sm:inline">● rec 2088</span>
      </div>

      <div className="vw-canvas-body">
        <svg viewBox="0 0 480 320" role="img" aria-label="A neon canvas showing a rectangle, circle, diamond and a freehand stroke being drawn live">
          <defs>
            <radialGradient id="vwSun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFB24D" />
              <stop offset="55%" stopColor="#FF00FF" />
              <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Perspective floor */}
          <g stroke={NEON.magenta} strokeWidth="1" opacity="0.55">
            <path d="M 20 264 H 460" />
            <path d="M 10 288 H 470" />
            <path d="M 0 316 H 480" />
            <path d="M 40 316 L 240 264 L 440 316" opacity="0.7" />
            <path d="M 110 316 L 240 264 L 370 316" opacity="0.7" />
            <path d="M 180 316 L 240 264 L 300 316" opacity="0.7" />
          </g>

          {/* Neon sun */}
          <circle cx="404" cy="76" r="96" fill="url(#vwSun)" opacity="0.85" />
          <circle cx="404" cy="76" r="44" fill={NEON.sunset} opacity="0.9" />

          {/* Shapes */}
          <g
            style={{
              filter: `drop-shadow(0 0 5px ${NEON.magenta})`,
            }}
          >
            <rect x="40" y="58" width="92" height="66" fill="none" stroke={NEON.magenta} strokeWidth="2.5" />
          </g>
          <g style={{ filter: `drop-shadow(0 0 5px ${NEON.cyan})` }}>
            <circle cx="252" cy="92" r="38" fill="none" stroke={NEON.cyan} strokeWidth="2.5" />
          </g>
          <g
            style={{
              filter: `drop-shadow(0 0 5px ${NEON.sunset})`,
            }}
          >
            <path d="M 382 62 L 410 86 L 382 110 L 354 86 Z" fill="none" stroke={NEON.sunset} strokeWidth="2.5" />
          </g>

          {/* Active freehand stroke being drawn */}
          <path
            d="M 56 196 C 88 176 118 208 150 188 C 182 168 204 202 236 186 C 268 170 296 200 328 182 C 356 166 388 196 424 174"
            fill="none"
            stroke={NEON.cyan}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1"
            style={{
              filter: `drop-shadow(0 0 6px ${NEON.cyan})`,
              strokeDashoffset: "1800",
              animation: "neodrawDrawLine 3.4s ease-in-out 0.4s infinite alternate",
            }}
          />
          <circle cx="56" cy="196" r="5" fill={NEON.cyan} opacity="0.9" />
        </svg>
      </div>

      <div className="vw-statusbar">
        <span>shape: freehand</span>
        <span>
          color: <span style={{ color: NEON.magenta }}>#FF00FF</span>
        </span>
        <span>
          peers: <span style={{ color: NEON.cyan }}>∞</span>
        </span>
        <span className="ml-auto">frame: 60fps</span>
      </div>
    </div>
  );
}