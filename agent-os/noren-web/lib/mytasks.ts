"use client";

import { useEffect, useState } from "react";

// The public sandbox redacts task text server-side. To keep the console
// useful, a visitor's OWN prompts are remembered in this browser only
// (localStorage, never sent anywhere) so their own tasks stay readable.
const KEY = "cov.mytasks";
const MAX = 50;
const PREFILL = "cov.prefill";
const EVENT = "cov-mytasks";

export type MyTasks = Record<string, string>;

export function loadMyTasks(): MyTasks {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as MyTasks) : {};
  } catch {
    return {};
  }
}

export function saveMyTask(id: string, text: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const cur = loadMyTasks();
    delete cur[id];
    // Object key order is insertion order, so re-adding puts it last.
    const next: MyTasks = { ...cur, [id]: text.slice(0, 2000) };
    const keys = Object.keys(next);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX))) delete next[k];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage disabled or full: tasks simply show as hidden
  }
}

export function useMyTasks(): MyTasks {
  const [tasks, setTasks] = useState<MyTasks>({});
  useEffect(() => {
    const read = () => setTasks(loadMyTasks());
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return tasks;
}

/** Stash a prompt so the home composer can pick it up after navigation. */
export function setPrefill(text: string): void {
  try {
    window.sessionStorage.setItem(PREFILL, text);
  } catch {
    // ignore
  }
}

export function takePrefill(): string | null {
  try {
    const v = window.sessionStorage.getItem(PREFILL);
    if (v !== null) window.sessionStorage.removeItem(PREFILL);
    return v;
  } catch {
    return null;
  }
}

export const HIDDEN_TASK_TEXT = "Another visitor's task (hidden)";

export function isRedacted(text: string | null | undefined): boolean {
  return !text || text.trim().startsWith("[redacted");
}

export const SAMPLE_PROMPTS: { skill: string; prompt: string; what: string }[] = [
  { skill: "hash", prompt: "hash hello world", what: "SHA-256 of any text" },
  { skill: "count", prompt: "count the words in the quick brown fox jumps over the lazy dog", what: "Words, characters and lines" },
  { skill: "plan", prompt: "plan launch a newsletter", what: "Breaks a goal into steps" },
  { skill: "calc", prompt: "calc 12*(3+4)", what: "Arithmetic" },
  { skill: "convert", prompt: "convert 5 km to miles", what: "Unit conversion" },
  { skill: "remember", prompt: "remember buy milk", what: "Saves a note to memory" },
  { skill: "help", prompt: "help", what: "Lists everything it can do" },
];
