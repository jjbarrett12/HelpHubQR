import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: "hsl(var(--sidebar-border))",
        "accent-border": "hsl(var(--accent-border))",
        "card-border": "hsl(var(--card-border))",
        neon: {
          red: "var(--neon-red)",
          "red-dim": "var(--neon-red-dim, #991f2e)",
        },
        status: {
          active: "hsl(var(--status-active))",
          late: "hsl(var(--status-late))",
          problem: "hsl(var(--status-problem))",
          completed: "hsl(var(--status-completed))",
          pending: "hsl(var(--status-pending))",
          "open-shift": "hsl(var(--status-open-shift))",
          overdue: "hsl(var(--status-overdue))",
          "missing-proof": "hsl(var(--status-missing-proof))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        neon: "0 0 12px hsl(350 100% 55% / 0.5), 0 0 24px hsl(350 100% 55% / 0.25)",
        "neon-sm": "0 0 8px hsl(350 100% 55% / 0.4)",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
