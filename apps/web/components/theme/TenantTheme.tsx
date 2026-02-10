"use client";

import { useEffect } from "react";

type Branding = { primary_color?: string | null };

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = hex.replace(/^#/, "").match(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function TenantTheme({ branding }: { branding: Branding | null }) {
  useEffect(() => {
    const primary = branding?.primary_color?.trim();
    const root = document.documentElement;
    if (primary && /^#[0-9A-Fa-f]{6}$/.test(primary)) {
      const hsl = hexToHsl(primary);
      if (hsl) {
        root.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${Math.min(hsl.l + 8, 100)}%`);
        root.style.setProperty("--primary-foreground", "0 0% 100%");
        root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        root.style.setProperty("--neon-red", primary);
        root.style.setProperty("--accent-border", `${hsl.h} ${Math.min(hsl.s + 20, 100)}% ${hsl.l}%`);
      }
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--neon-red");
      root.style.removeProperty("--accent-border");
    }
  }, [branding?.primary_color]);
  return null;
}
