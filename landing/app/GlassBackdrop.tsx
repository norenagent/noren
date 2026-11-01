"use client";

import { useSyncExternalStore } from "react";
import ElsewhereHero from "@/components/ui/elsewhere-hero";

const subscribe = () => () => {};
// The head script sets `glass-site` on <html> before first paint, everywhere except the docs.
const isGlass = () => document.documentElement.classList.contains("glass-site");

/**
 * Day/night footage fixed behind every page except the docs. It lives in the root
 * layout, so the video keeps playing (and the day/sound state survives) while the
 * visitor moves between pages.
 */
export function GlassBackdrop() {
  const on = useSyncExternalStore(subscribe, isGlass, () => false);
  if (!on) return null;
  return (
    <div className="gs-backdrop">
      <ElsewhereHero backdrop objectPosition="50% 50%" soundHint="" />
    </div>
  );
}
