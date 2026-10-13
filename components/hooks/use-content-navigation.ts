"use client";
import { useCallback, useEffect, useState, type RefObject } from "react";

type ContentTarget = RefObject<HTMLElement | null> | (() => HTMLElement | null);

// Requests made alongside reveal state run after the destination's DOM commit.
// A new request also handles switching content while the section is already open.
export function useContentNavigation() {
  const [request, setRequest] = useState<{
    target: ContentTarget;
    block: ScrollLogicalPosition;
  } | null>(null);
  useEffect(() => {
    if (!request) return;
    const target =
      typeof request.target === "function"
        ? request.target()
        : request.target.current;
    if (!target?.isConnected) return;
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: request.block,
    });
    // Focusing the heading must not cause a second scroll or interrupt smooth motion.
    target.focus({ preventScroll: true });
  }, [request]);
  return useCallback(
    (target: ContentTarget, block: ScrollLogicalPosition = "start") => {
      setRequest({ target, block });
    },
    [],
  );
}
