/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Manrope'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      colors: {
        ink: "#12151b",
        paper: "#f7f6f2",
        panel: "#ffffff",
        border: "#e6e3da",
        accent: {
          DEFAULT: "#c2650f",
          soft: "#fdf1e4",
        },
        teal: {
          DEFAULT: "#155e5a",
          soft: "#e6f2f1",
        },
        good: { DEFAULT: "#1a7a45", soft: "#e6f5ec" },
        mid: { DEFAULT: "#a3720d", soft: "#fbf1dc" },
        low: { DEFAULT: "#b5342c", soft: "#fbeae8" },
        sidebar: "#12151b",
        "sidebar-hover": "#1d222b",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,21,27,0.04), 0 1px 8px rgba(18,21,27,0.04)",
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};
