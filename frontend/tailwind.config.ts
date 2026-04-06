import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        water: "#3B82F6",
        food: "#22C55E",
        fuel: "#F97316",
        hygiene: "#A855F7",
        medical: "#EF4444",
        energy: "#EAB308",
      },
      fontFamily: {
        sans: ["Vazirmatn", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
