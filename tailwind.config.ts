import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b0f",
        panel: "#14141c",
        panel2: "#1c1c28",
        edge: "#2a2a3a",
        neon: "#ff3d6e",      // Rocky pink-red (stage light)
        amber: "#ffb33d",     // marquee amber
        cyan: "#3df0ff",      // BC glacier
        moss: "#3ddc84",      // open-slot green
        muted: "#8a8aa0",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["system-ui", "sans-serif"],
      },
      boxShadow: { glow: "0 0 24px rgba(255,61,110,0.35)" },
    },
  },
  plugins: [],
} satisfies Config;
