"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Slot pattern: a page calls `useRightRail(<jsx>)` and gets its JSX rendered
// into the Shell's optional right column. The JSX is rendered with a React
// portal into an element the Shell owns, so the page's live state keeps
// flowing into it without writing JSX into shared state on every commit
// (the old effect did that and looped forever, which froze client navigation
// on the home page).

type Ctx = {
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  active: boolean;
  setActive: (v: boolean) => void;
};

const RightRailContext = createContext<Ctx | null>(null);

export function RightRailProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  return (
    <RightRailContext.Provider value={{ slot, setSlot, active, setActive }}>
      {children}
    </RightRailContext.Provider>
  );
}

/** Shell: whether a page currently mounts a rail. */
export function useRightRailActive(): boolean {
  const ctx = useContext(RightRailContext);
  return ctx ? ctx.active : false;
}

/** Shell: ref callback for the element the rail is portaled into. */
export function useRightRailSlotRef(): (el: HTMLElement | null) => void {
  const ctx = useContext(RightRailContext);
  return ctx ? ctx.setSlot : () => {};
}

/**
 * Render `node` into Shell's right rail. Marks the rail active on mount and
 * inactive on unmount (deps are stable, so this effect runs once).
 */
export function useRightRail(node: ReactNode | null): ReactNode {
  const ctx = useContext(RightRailContext);
  const setActive = ctx?.setActive;
  useEffect(() => {
    if (!setActive) return;
    setActive(true);
    return () => setActive(false);
  }, [setActive]);
  if (!ctx || !ctx.slot || node === null) return null;
  return createPortal(node, ctx.slot);
}
