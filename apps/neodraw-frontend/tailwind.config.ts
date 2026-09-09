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
      },
    },
  },
  plugins: [],
};

export default config;
