/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          bg: "rgb(var(--c-bg) / <alpha-value>)",
          panel: "rgb(var(--c-panel) / <alpha-value>)",
          card: "rgb(var(--c-card) / <alpha-value>)",
          raised: "rgb(var(--c-raised) / <alpha-value>)",
          line: "rgb(var(--c-line) / <alpha-value>)",
          lineStrong: "rgb(var(--c-line-strong) / <alpha-value>)",
          text: "rgb(var(--c-text) / <alpha-value>)",
          muted: "rgb(var(--c-muted) / <alpha-value>)",
          accent: "rgb(var(--c-accent) / <alpha-value>)",
          gold: "rgb(var(--c-gold) / <alpha-value>)",
          warn: "rgb(var(--c-warn) / <alpha-value>)",
          bad: "rgb(var(--c-bad) / <alpha-value>)",
          good: "rgb(var(--c-good) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Fraunces", "Georgia", "Times New Roman", "serif"]
      },
      borderRadius: { xl: "16px", lg: "10px" }
    }
  },
  plugins: []
};
