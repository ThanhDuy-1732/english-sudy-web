import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Design tokens live as RGB triplets in globals.css (one set per data-theme), so every token follows the theme.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const leaf = { ...colors.green, 500: colors.green[700], 600: colors.green[700], 700: colors.green[800] };

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
        primary: { DEFAULT: token("primary"), strong: token("primary-strong"), soft: token("primary-soft"), text: token("primary-text") },
        marker: token("marker"),
        soil: token("soil"),
        deep: "#17332a",
        margin: { DEFAULT: token("margin"), soft: token("margin-soft") },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        // One accent family: the old purple/violet/indigo accents all read as the ballpoint blue, greys are ink-tinted.
        // Older accent classes (blue/purple/…) fall into the leaf green; greys are neutral.
        // Shifted one step darker so old text-*-500/600 labels stay ≥4.5:1 on the mint paper.
        blue: leaf,
        purple: leaf,
        violet: leaf,
        indigo: leaf,
        green: { ...colors.green, 600: colors.green[700] },
        gray: colors.neutral,
      },
      fontFamily: {
        // Lexend: interface text. Baloo 2: headings. Fraunces: English words on postcards and example sentences.
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
        en: ["var(--font-en)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
