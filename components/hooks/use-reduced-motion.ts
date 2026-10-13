"use client";
import { useSyncExternalStore } from "react";
const media = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (callback: () => void) => {
  const query = media();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => media().matches,
    () => true,
  );
}
