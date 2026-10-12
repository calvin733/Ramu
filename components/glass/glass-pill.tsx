import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GlassPill({
  tone = "sage",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "sage" | "amber" }) {
  return (
    <span
      className={cn("glass-pill", `glass-pill-${tone}`, className)}
      {...props}
    />
  );
}
