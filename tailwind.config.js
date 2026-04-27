/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      spacing: {
        page: "2rem",
        "page-x": "1rem",
        section: "1.25rem",
      },
    },
  },
  plugins: [],
};
