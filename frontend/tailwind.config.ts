import type { Config } from "tailwindcss";

/**
 * Editorial "publishing studio" design system.
 * Palette: warm paper + ink charcoal, muted burgundy accent, citation gold for audio.
 * Type: Playfair Display (display serif) / Source Serif 4 (body) / JetBrains Mono (audio metadata).
 * The old purple/blue/glass tokens are intentionally gone.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paper (light editorial surfaces)
        paper: {
          DEFAULT: "#F4F1EA", // warm ivory
          bright: "#FBF9F4", // page white
          shade: "#E9E4D8", // margin / recessed paper
          line: "#DCD5C6", // ruled line / hairline border
        },
        // Ink (dark editorial surfaces + text)
        ink: {
          DEFAULT: "#1A1815", // near-black warm charcoal
          soft: "#2A2723", // raised ink surface
          muted: "#6B6459", // secondary text on paper
          faint: "#9A9284", // tertiary / metadata
        },
        // Muted burgundy — primary accent (editorial, not neon)
        burgundy: {
          DEFAULT: "#7C2D3A",
          soft: "#9B4552",
          deep: "#5A1F29",
        },
        // Citation gold — the "audio" material color (waveforms, timecodes)
        gold: {
          DEFAULT: "#B45309",
          soft: "#D08A3E",
          faint: "#E6C79A",
        },
        // Neutral surface tokens keyed to the dark editorial ground
        surface: {
          DEFAULT: "#211E1A",
          hover: "#2A2723",
          active: "#33302A",
        },
        hairline: {
          DEFAULT: "rgba(244, 241, 234, 0.10)",
          strong: "rgba(244, 241, 234, 0.18)",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        serif: ["var(--font-source-serif)", "Source Serif 4", "Georgia", "serif"],
        sans: ["var(--font-source-serif)", "Source Serif 4", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.22em",
      },
      maxWidth: {
        measure: "68ch", // editorial reading measure
      },
      keyframes: {
        "waveform-idle": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        "ink-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "waveform-idle": "waveform-idle 1.2s ease-in-out infinite",
        "ink-in": "ink-in 0.6s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
