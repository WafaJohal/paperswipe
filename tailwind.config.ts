import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#1a1a1a",
        "surface-2": "#242424",
        accent: {
          pink: "#ff3b7f",
          orange: "#ff7b3b",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
