import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/data/**/*.{ts,tsx}",
    "./src/utils/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      colors: {
        gainix: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#881337",
          900: "#4c0519",
          950: "#21020c",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(244,63,94,0.16), 0 18px 60px rgba(127,29,29,0.36)",
        soft: "0 20px 60px rgba(2, 6, 23, 0.45)",
      },
      backgroundImage: {
        "panel-noise":
          "radial-gradient(circle at top left, rgba(244,63,94,0.18), transparent 28%), radial-gradient(circle at top right, rgba(127,29,29,0.22), transparent 26%), linear-gradient(180deg, rgba(24,24,27,0.98) 0%, rgba(10,10,12,0.98) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
