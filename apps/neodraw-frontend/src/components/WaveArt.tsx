const BIRDS: ReadonlyArray<[number, number, number]> = [
  [90, 130, 1],
  [140, 80, 0.8],
  [330, 110, 1.1],
  [430, 60, 0.75],
  [560, 95, 1],
  [700, 55, 0.9],
  [815, 130, 0.8],
  [1120, 90, 1],
  [1065, 160, 0.85],
  [240, 210, 0.7],
  [500, 150, 0.65],
  [640, 200, 0.9],
  [960, 210, 0.75],
  [1150, 230, 0.7],
  [70, 250, 0.6],
];

const SWIRLS: ReadonlyArray<string> = [
  "M 40 100 C 120 60 220 100 200 170 C 184 220 110 204 128 150",
  "M 300 70 C 380 40 440 80 420 140 C 404 184 350 170 362 122",
  "M 560 70 C 600 40 650 50 664 100 C 674 134 636 142 622 112",
  "M 700 96 C 760 60 860 70 900 130 C 926 168 884 190 850 162",
  "M 70 220 C 140 200 200 230 226 300 C 242 346 190 350 172 310",
  "M 260 210 C 310 190 360 210 380 270 C 392 312 348 322 330 288",
  "M 460 170 C 520 150 560 180 560 240 C 560 288 506 292 494 252",
  "M 1040 180 C 1106 150 1146 196 1112 250 C 1086 292 1032 282 1024 244",
  "M 780 310 C 850 280 910 320 880 380 C 858 424 790 410 784 366",
];

const HOOKS: ReadonlyArray<string> = [
  "M 596 268 c 26 -26 68 -22 80 4 c 11 23 -16 40 -34 28 c -14 -9 -4 -30 8 -26",
  "M 544 240 c 18 -28 58 -30 76 -10 c 15 17 -2 40 -20 36 c -15 -3 -12 -24 0 -28",
  "M 636 316 c 24 -16 60 -8 68 18 c 7 24 -20 36 -36 26 c -12 -8 -6 -28 4 -30",
  "M 498 226 c 10 -26 46 -34 64 -20 c 15 12 4 34 -14 34 c -13 0 -14 -16 -6 -24",
];

export function WaveArt() {
  return (
    <svg
      viewBox="0 0 1200 820"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A tall ship sailing through a great wave beneath a burning sun"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6B00" />
          <stop offset="1" stopColor="#E35000" />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stopColor="#FFB34D" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFB34D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17303A" />
          <stop offset="1" stopColor="#0A1419" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="1200" height="820" fill="url(#skyGrad)" />

      {/* Sun */}
      <circle cx="935" cy="235" r="320" fill="url(#sunGlow)" />
      <circle cx="935" cy="235" r="150" fill="#FFA02E" />
      <circle cx="935" cy="235" r="116" fill="#FF8A00" />
      <circle cx="935" cy="235" r="84" fill="#FF7200" />

      {/* Swirling sky lines */}
      <g stroke="#16333D" strokeWidth="2.4" fill="none" opacity="0.5" strokeLinecap="round">
        {SWIRLS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Seabirds */}
      <g stroke="#16333D" strokeWidth="2" fill="none" opacity="0.85" strokeLinecap="round">
        {BIRDS.map(([x, y, s]) => (
          <path
            key={`${x}-${y}`}
            transform={`translate(${x} ${y}) scale(${s})`}
            d="M 0 0 q 14 -16 28 0 M 0 0 q -14 -16 -28 0"
          />
        ))}
      </g>

      {/* Distant back crest */}
      <path d="M -20 300 C 80 210 210 190 290 240 C 350 275 372 320 330 340 C 240 375 100 370 -20 340 Z" fill="#2E4F5C" stroke="#0A1419" strokeWidth="3" />
      <path d="M -20 300 C 80 210 210 190 290 240" stroke="#FFB34D" strokeWidth="4" fill="none" />
      <path d="M 266 206 c 16 -34 58 -44 76 -24 c 14 16 2 38 -16 34 c -14 -3 -12 -22 -2 -26" stroke="#2E4F5C" strokeWidth="3" fill="none" />

      {/* Main wave bands */}
      <path d="M -20 470 C 150 330 330 292 462 244 C 548 212 606 224 648 280 C 688 336 660 400 592 412 C 528 424 424 410 330 424 C 210 438 90 470 -20 500 Z" fill="#24404C" stroke="#060D11" strokeWidth="3" />
      <path d="M -20 470 C 150 330 330 292 462 244 C 520 224 566 230 600 262" stroke="#FFB34D" strokeWidth="5" fill="none" />
      <g stroke="#0A1419" strokeWidth="4" fill="none" strokeLinecap="round">
        {HOOKS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <path d="M -20 560 C 150 470 300 435 430 405 C 500 390 548 420 528 468 C 508 516 436 530 342 528 C 220 524 100 560 -20 590 Z" fill="url(#waveGrad)" stroke="#060D11" strokeWidth="3" />
      <path d="M -20 560 C 150 470 300 435 430 405" stroke="#FFB34D" strokeWidth="4.5" fill="none" />

      <path d="M -20 650 C 130 590 260 565 380 558 C 452 552 482 586 462 632 C 442 676 366 690 280 688 C 170 700 60 690 -20 700 Z" fill="#0F212E" stroke="#060D11" strokeWidth="3" />
      <path d="M -20 650 C 130 590 260 565 380 558" stroke="#FF9E3F" strokeWidth="4" fill="none" />

      <path d="M -20 740 C 150 700 300 688 450 690 C 540 692 560 730 560 770 L -20 800 Z" fill="#0A161E" stroke="#060D11" strokeWidth="3" />
      <path d="M -20 740 C 150 700 300 688 450 690" stroke="#FFB34D" strokeWidth="4" fill="none" />

      {/* Primary galleon */}
      <g transform="rotate(-7 350 560)">
        <path d="M 90 650 C 220 676 420 672 540 646 C 560 636 575 622 585 606 C 470 590 260 596 120 622 Z" fill="#0B1116" />
        <path d="M 585 606 C 620 598 640 572 672 552" stroke="#0B1116" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 606 600 L 636 570" stroke="#FFF3D9" strokeWidth="2.4" fill="none" />

        <g stroke="#0B1116" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M 268 598 L 268 354" />
          <path d="M 384 588 L 384 226" />
          <path d="M 500 600 L 500 338" />
        </g>

        <path d="M 278 392 C 342 400 356 446 330 486 C 302 502 268 498 256 482 C 274 456 274 420 278 392 Z" fill="#0B1116" />
        <path d="M 276 330 C 336 336 348 380 322 416 C 296 432 264 428 254 414 C 268 392 272 358 276 330 Z" fill="#0B1116" />
        <path d="M 402 246 C 500 258 524 322 492 384 C 458 400 414 396 402 380 C 422 350 416 292 402 246 Z" fill="#0B1116" />
        <path d="M 402 190 C 448 194 462 228 440 262 C 424 270 406 268 398 258 C 410 240 408 214 402 190 Z" fill="#0B1116" />
        <path d="M 512 344 C 566 352 578 394 552 430 C 528 446 498 442 488 428 C 504 404 506 372 512 344 Z" fill="#0B1116" />
        <path d="M 660 566 C 700 570 710 600 690 630 C 674 636 660 632 654 622 C 668 604 664 584 660 566 Z" fill="#0B1116" />

        <path d="M 384 226 L 452 222 L 396 262 Z" fill="#FF6B00" />

        <g stroke="#0B1116" strokeWidth="1.6" fill="none" opacity="0.9">
          <path d="M 384 226 L 500 338" />
          <path d="M 384 226 L 268 354" />
          <path d="M 384 226 L 650 552" />
        </g>

        <g stroke="#FFF1D7" strokeWidth="1.3" fill="none" opacity="0.75">
          <path d="M 438 300 C 468 322 470 358 448 382" />
          <path d="M 296 420 C 316 436 318 468 300 484" />
          <path d="M 533 372 C 548 386 548 414 532 430" />
          <path d="M 200 630 L 520 618" />
          <path d="M 150 646 L 500 636" />
        </g>

        <g stroke="#FFB34D" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9">
          <path d="M 520 668 q 24 18 60 6" />
          <path d="M 560 676 q 20 14 48 2" />
          <path d="M 600 664 q 16 -12 34 -18" />
        </g>
      </g>

      {/* Distant ship, small */}
      <g transform="translate(960 540) scale(0.55) rotate(4)">
        <path d="M 30 90 C 90 104 150 102 190 88 C 200 80 208 70 212 62 C 120 56 70 68 45 84 Z" fill="#0B1116" />
        <g stroke="#0B1116" strokeWidth="5" fill="none">
          <path d="M 80 88 L 80 30" />
          <path d="M 120 84 L 118 12" />
          <path d="M 158 84 L 160 34" />
        </g>
        <path d="M 120 18 C 150 22 158 40 148 56 C 138 58 128 56 124 52 C 132 40 132 28 120 18 Z" fill="#0B1116" />
        <path d="M 80 44 C 106 48 112 64 104 78 C 96 80 88 78 86 74 C 94 64 92 52 80 44 Z" fill="#0B1116" />
      </g>
      <path d="M 760 780 C 880 730 1010 720 1180 770 L 1220 790 L 760 800 Z" fill="#0A161E" stroke="#060D11" strokeWidth="3" />

      {/* Foreground swell */}
      <path d="M -20 806 C 150 776 320 788 460 748 C 620 712 760 716 860 688 C 980 656 1080 668 1220 640 L 1220 820 L -20 820 Z" fill="#071015" stroke="#05090B" strokeWidth="3" />
      <path d="M -20 806 C 150 776 320 788 460 748" stroke="#FFB34D" strokeWidth="3" fill="none" opacity="0.85" />

      {/* Spray */}
      <g fill="#FFD9A0" opacity="0.85">
        <circle cx="620" cy="238" r="4" />
        <circle cx="644" cy="218" r="3" />
        <circle cx="672" cy="252" r="3.4" />
        <circle cx="686" cy="286" r="2.6" />
        <circle cx="560" cy="288" r="3.4" />
        <circle cx="700" cy="246" r="2.4" />
      </g>
    </svg>
  );
}