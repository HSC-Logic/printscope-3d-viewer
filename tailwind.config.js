/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { ink: "#101828", brand: "#f97316", panel: "#161b26" } },
  },
  plugins: [],
};
