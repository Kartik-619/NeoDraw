import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ffffff",
          hover: "#ececec",
          soft: "rgba(255, 255, 255, 0.12)",
        },
        ink: "#000000",
        paper: "#FFFFFF",
        surface: "#0E0E0E",
        muted: "#8A8A8A",
        void: "#090014",
        chrome: "#E0E0E0",
        glass: "#1a103c",
        magenta: "#FF00FF",
        cyan: "#00FFFF",
        sunset: "#FF9900",
        neon: "#2D1B4E",
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        mono: ["Share Tech Mono", "monospace"],
      },
      boxShadow: {
        "glow-magenta": "0 0 10px #FF00FF",
        "glow-magenta-lg": "0 0 24px #FF00FF",
        "glow-cyan": "0 0 15px #00FFFF",
        "glow-cyan-soft": "0 0 20px rgba(0, 255, 255, 0.2)",
        "glow-cyan-lg": "0 0 40px rgba(0, 255, 255, 0.35)",
        "glow-sunset": "0 0 25px rgba(255, 153, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;