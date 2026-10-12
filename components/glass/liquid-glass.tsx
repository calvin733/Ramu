"use client";
import { useEffect, useRef } from "react";
import { canUseLiquidGlass } from "./policy";
import { cn } from "@/lib/utils";

// Decorative only: the semantic control and text remain ordinary DOM content.
export function LiquidGlass({
  tone = "sage",
  className,
}: {
  tone?: "sage" | "green";
  className?: string;
}) {
  const layer = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = layer.current;
    const host = element?.parentElement;
    if (!element || !host || typeof window === "undefined") return;
    if (
      !window.matchMedia ||
      !window.IntersectionObserver ||
      !window.ResizeObserver
    )
      return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)");
    if (!motion.addEventListener || !desktop.addEventListener) return;
    const device = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    let disposed = false,
      visible = false,
      failed = false,
      starting = false;
    let generation = 0;
    let renderer: { dispose: () => void } | null = null;
    let idle: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const eligible = () =>
      canUseLiquidGlass({
        width: window.innerWidth,
        reducedMotion: motion.matches,
        finePointer: desktop.matches,
        saveData: device.connection?.saveData,
        memory: device.deviceMemory,
        cores: device.hardwareConcurrency,
      });
    function cancelStart() {
      generation++;
      starting = false;
      if (idle !== null) window.cancelIdleCallback?.(idle);
      if (timer !== null) clearTimeout(timer);
      idle = null;
      timer = null;
    }
    function stop() {
      cancelStart();
      renderer?.dispose();
      renderer = null;
      element!.dataset.glassState = "css";
    }
    function update() {
      if (disposed || !visible || document.hidden || !eligible()) {
        stop();
        return;
      }
      if (failed || renderer || starting) return;
      starting = true;
      const version = ++generation;
      const initialize = async () => {
        idle = null;
        timer = null;
        try {
          const { createLiquidRenderer } = await import("./renderer");
          if (
            disposed ||
            version !== generation ||
            !visible ||
            document.hidden ||
            !eligible()
          )
            return;
          renderer = createLiquidRenderer(element!, tone, () => {
            failed = true;
            stop();
          });
          if (renderer) element!.dataset.glassState = "webgl";
          else failed = true;
        } catch {
          // Shader/canvas/init failures never affect the control or reach users.
          failed = true;
          stop();
        } finally {
          if (version === generation) starting = false;
        }
      };
      if (window.requestIdleCallback)
        idle = window.requestIdleCallback(() => void initialize(), {
          timeout: 700,
        });
      else timer = setTimeout(() => void initialize(), 120);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.01 },
    );
    observer.observe(host);
    motion.addEventListener("change", update);
    desktop.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      motion.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [tone]);
  return (
    <span
      ref={layer}
      className={cn("liquid-layer glass-fallback", className)}
      data-glass-state="css"
      aria-hidden="true"
    />
  );
}
