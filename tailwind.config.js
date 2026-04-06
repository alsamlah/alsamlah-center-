/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font)"],
      },
      colors: {
        th: {
          bg: "var(--bg)", bg2: "var(--bg2)", surface: "var(--surface)", surface2: "var(--surface2)",
          accent: "var(--accent)", accent2: "var(--accent2)", blue: "var(--blue)", green: "var(--green)",
          red: "var(--red)", yellow: "var(--yellow)", text: "var(--text)", text2: "var(--text2)",
          border: "var(--border)", card: "var(--card-bg)", "card-border": "var(--card-border)",
          input: "var(--input-bg)", nav: "var(--nav-bg)",
        },
      },
    },
  },
  plugins: [],
}
