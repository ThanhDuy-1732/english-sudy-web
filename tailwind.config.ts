import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Design tokens live as RGB triplets in globals.css (one set per data-theme), so every token follows the theme.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // The theme script keeps data-theme on <html> as the resolved theme, so dark: follows the setting, not only the OS.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        card: token("card"),
        ink: token("ink"),
        muted: token("muted"),
        rule: token("rule"),
        primary: { DEFAULT: token("primary"), strong: token("primary-strong"), soft: token("primary-soft") },
        marker: token("marker"),
        deep: "#16233f",
        margin: { DEFAULT: token("margin"), soft: token("margin-soft") },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        // One accent family: the old purple/violet/indigo accents all read as the ballpoint blue, greys are ink-tinted.
        purple: colors.blue,
        violet: colors.blue,
        indigo: colors.blue,
        gray: colors.slate,
      },
      fontFamily: {
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        // English study content (words, example sentences, passages) is set in the serif.
        display: ["var(--font-en)", "Georgia", "serif"],
        en: ["var(--font-en)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
