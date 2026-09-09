/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- THIS LINE IS CRUCIAL
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

