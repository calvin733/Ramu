"use client";
import {
  GOALS_KEY,
  parseStoredGoals,
  serializeGoals,
  type BusinessGoal,
} from "./index";
const EMPTY: BusinessGoal[] = [];
let cached = EMPTY;
let rawCache: string | null | undefined;
export const serverGoals = () => EMPTY;
export function readGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (raw !== rawCache) {
      rawCache = raw;
      cached = parseStoredGoals(raw);
    }
  } catch {
    /* Storage can be unavailable in private browsers. */
  }
  return cached;
}
export function subscribeGoals(callback: () => void) {
  const listener = (e: StorageEvent) => {
    if (e.key === GOALS_KEY || e.key === null) callback();
  };
  window.addEventListener("storage", listener);
  window.addEventListener("ramu-goals-changed", callback);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("ramu-goals-changed", callback);
  };
}
export function writeGoals(goals: BusinessGoal[]) {
  const raw = serializeGoals(goals);
  try {
    localStorage.setItem(GOALS_KEY, raw);
  } catch {
    throw new Error(
      "Target belum dapat disimpan. Izinkan penyimpanan lokal di browser Anda.",
    );
  }
  window.dispatchEvent(new Event("ramu-goals-changed"));
}
