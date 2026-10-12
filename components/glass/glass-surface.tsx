import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "aside" | "article" | "header";
  strength?: "soft" | "strong" | "nested";
}

export function GlassSurface({
  as: Component = "section",
  strength = "soft",
  className,
  ...props
}: GlassSurfaceProps) {
  return (
    <Component
      className={cn("glass-surface", `glass-${strength}`, className)}
      {...props}
    />
  );
}
