const LEAVES: ReadonlyArray<[number, number, number, number]> = [
  [760, 352, 7, 0],
  [790, 342, 6, 1],
  [828, 350, 8, 2],
  [814, 372, 6, 0],
  [848, 340, 7, 1],
  [862, 366, 8, 2],
  [880, 326, 6, 0],
  [900, 340, 8, 1],
  [906, 372, 7, 0],
  [868, 398, 6, 2],
  [836, 408, 7, 0],
  [806, 394, 6, 1],
  [770, 386, 8, 2],
  [738, 372, 6, 0],
  [714, 350, 7, 1],
  [732, 330, 6, 2],
  [700, 342, 8, 0],
  [678, 368, 6, 1],
  [692, 400, 7, 2],
  [722, 414, 6, 0],
  [752, 426, 8, 1],
  [786, 418, 6, 2],
  [818, 436, 7, 0],
  [846, 424, 6, 1],
  [862, 442, 8, 2],
  [896, 404, 6, 0],
  [924, 380, 7, 1],
  [940, 352, 6, 2],
  [964, 340, 8, 0],
  [980, 362, 6, 1],
  [992, 392, 7, 2],
  [1004, 336, 6, 0],
  [1020, 356, 8, 1],
  [1034, 384, 6, 2],
  [1042, 318, 7, 0],
  [1064, 304, 6, 1],
  [1080, 340, 8, 2],
  [1092, 318, 6, 0],
  [1106, 356, 7, 1],
  [1120, 302, 6, 2],
  [1132, 334, 8, 0],
  [1150, 316, 6, 1],
  [1170, 348, 7, 2],
  [1012, 422, 6, 0],
  [952, 448, 6, 1],
  [886, 468, 6, 2],
  [820, 470, 6, 0],
  [748, 452, 6, 1],
];

const FALLEN: ReadonlyArray<[number, number, number, number]> = [
  [680, 520, 5, 0],
  [730, 560, 6, 1],
  [780, 540, 5, 2],
  [830, 590, 6, 0],
  [880, 520, 5, 1],
  [920, 570, 6, 2],
  [960, 610, 5, 0],
  [600, 590, 5, 1],
  [640, 640, 6, 2],
  [700, 620, 5, 0],
  [520, 570, 5, 1],
  [760, 660, 5, 2],
];

const WATER: ReadonlyArray<string> = [
  "M 0 600 C 200 596 400 604 600 600 C 800 596 1000 604 1200 600",
  "M 0 640 C 250 636 450 644 700 640 C 950 636 1100 644 1200 640",
  "M 0 690 C 300 686 500 694 800 690 C 1000 686 1150 692 1200 690",
  "M 0 748 C 350 744 600 752 900 748 C 1050 744 1150 748 1200 748",
  "M 0 792 C 300 788 600 796 950 792 C 1100 788 1180 792 1200 790",
];

export function ZenArt() {
  const leafColors = ["#FF6B57", "#FF806D", "#E55640"];

  return (
    <svg
      viewBox="0 0 1200 820"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A red torii gate by a calm sea, a great red sun behind dark mountains, and a tree with red leaves"
    >
      <defs>
        <linearGradient id="zenSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1F5755" />
          <stop offset="1" stopColor="#1A4A4A" />
        </linearGradient>
        <linearGradient id="zenSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#134244" />
          <stop offset="1" stopColor="#0D2A2A" />
        </linearGradient>
        <radialGradient id="sunHalo">
          <stop offset="0" stopColor="#FF6B57" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FF6B57" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky and sea */}
      <rect width="1200" height="560" fill="url(#zenSky)" />
      <rect y="560" width="1200" height="260" fill="url(#zenSea)" />

      {/* Sun low on the horizon */}
      <circle cx="760" cy="500" r="300" fill="url(#sunHalo)" />
      <circle cx="760" cy="500" r="172" fill="#FF6B57" />

      {/* Mist bands */}
      <g fill="#8FC0BA" opacity="0.1">
        <ellipse cx="300" cy="505" rx="260" ry="22" />
        <ellipse cx="780" cy="500" rx="320" ry="26" />
        <ellipse cx="1000" cy="540" rx="240" ry="18" />
      </g>

      {/* Mountains partially veiling the sun */}
      <path
        d="M 540 585 L 600 470 C 640 430 700 430 740 465 C 800 520 860 460 940 415 C 1030 370 1120 430 1200 415 L 1200 585 Z"
        fill="#000000"
      />
      <path d="M 600 585 C 700 556 860 570 980 585 L 1200 585 L 1200 585 Z" fill="#000000" opacity="0.5" />
      <path d="M 0 585 C 120 560 260 570 360 585 Z" fill="#000000" opacity="0.55" />

      {/* Suns reflection on the water */}
      <path d="M 690 585 L 830 585 L 810 700 L 710 700 Z" fill="#FF6B57" opacity="0.38" />
      <g stroke="#FF8A76" fill="none" opacity="0.6">
        <path d="M 690 620 C 720 616 760 622 806 620" strokeWidth="3" />
        <path d="M 700 650 C 730 646 764 652 800 650" strokeWidth="2.5" />
        <path d="M 710 685 C 736 682 768 686 794 684" strokeWidth="2" />
      </g>

      {/* Woodblock water bands */}
      <g stroke="#0B2626" strokeWidth="2" fill="none" opacity="0.6">
        {WATER.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Torii gate, vermilion */}
      <rect x="150" y="578" width="210" height="9" fill="#000000" opacity="0.85" />
      <rect x="206" y="388" width="15" height="192" fill="#C94A2E" />
      <rect x="286" y="388" width="15" height="192" fill="#C94A2E" />
      <rect x="168" y="374" width="170" height="11" fill="#C94A2E" />
      <rect x="116" y="366" width="274" height="12" fill="#C94A2E" />
      <path d="M 100 356 Q 254 322 408 356 Q 408 368 254 344 Q 100 368 100 356 Z" fill="#C94A2E" />

      {/* Samurai silhouette */}
      <g fill="#000000">
        <path d="M 232 548 L 274 548 L 274 562 L 232 562 Z" />
        <path d="M 243 490 L 266 490 L 276 512 L 258 516 L 258 558 L 248 558 L 248 516 L 232 512 Z" />
        <rect x="248" y="482" width="10" height="9" />
        <circle cx="253" cy="472" r="9" />
        <circle cx="253" cy="460" r="4" />
      </g>
      <path d="M 262 500 L 288 508" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
      <path d="M 288 508 L 322 466" stroke="#000000" strokeWidth="4" strokeLinecap="round" />

      {/* Distant gulls */}
      <g stroke="#0A0B0B" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M 620 300 q 12 -12 25 0 M 620 300 q -12 -12 -25 0" />
        <path d="M 700 258 q 10 -10 20 0 M 700 258 q -10 -10 -20 0" />
        <path d="M 886 296 q 10 -10 20 0 M 886 296 q -10 -10 -20 0" />
      </g>

      {/* Dark shore for the tree */}
      <path d="M 1040 585 C 1100 560 1180 560 1200 585 L 1200 820 L 1040 820 Z" fill="#000000" opacity="0.92" />

      {/* Tree trunk and branches */}
      <g stroke="#000000" fill="none" strokeLinecap="round">
        <path d="M 1172 640 C 1150 520 1120 420 1050 350" strokeWidth="42" />
        <path d="M 1050 350 C 1010 310 980 292 940 300" strokeWidth="26" />
        <path d="M 1060 400 C 980 360 900 340 810 355" strokeWidth="18" />
        <path d="M 1000 320 C 930 280 860 280 780 320" strokeWidth="14" />
        <path d="M 940 300 C 880 300 820 330 760 360" strokeWidth="12" />
        <path d="M 1060 340 C 1100 290 1140 270 1180 270" strokeWidth="12" />
        <path d="M 830 350 C 780 330 740 330 700 350" strokeWidth="7" />
        <path d="M 880 322 C 840 300 800 305 770 330" strokeWidth="6" />
        <path d="M 760 330 C 710 310 670 320 640 340" strokeWidth="5" />
        <path d="M 940 300 C 930 260 950 240 980 230" strokeWidth="8" />
        <path d="M 1140 270 C 1160 240 1180 230 1200 240" strokeWidth="6" />
        <path d="M 998 238 C 1018 226 1040 226 1058 236" strokeWidth="5" />
      </g>

      {/* Cascading red leaves */}
      {LEAVES.map(([x, y, r, c], i) => (
        <circle key={`l${i}`} cx={x} cy={y} r={r} fill={leafColors[c % 3]} />
      ))}
      {FALLEN.map(([x, y, r, c], i) => (
        <circle key={`f${i}`} cx={x} cy={y} r={r} fill={leafColors[c % 3]} opacity="0.8" />
      ))}

      {/* Sparse accent leaves high in the canopy */}
      <g fill="#FF6B57">
        <circle cx="700" cy="318" r="8" />
        <circle cx="668" cy="332" r="7" />
        <circle cx="736" cy="306" r="7" />
        <circle cx="788" cy="300" r="8" />
        <circle cx="838" cy="318" r="7" />
      </g>
    </svg>
  );
}