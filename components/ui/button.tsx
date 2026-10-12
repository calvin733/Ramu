import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { LiquidGlass } from "@/components/glass/liquid-glass";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  asChild?: boolean;
  liquid?: boolean;
}
export function Button({
  className,
  variant = "primary",
  asChild = false,
  liquid = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "button",
        `button-${variant}`,
        liquid && !asChild && "liquid-host",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {liquid && (
            <LiquidGlass tone={variant === "primary" ? "green" : "sage"} />
          )}
          <span className="button-content">{children}</span>
        </>
      )}
    </Comp>
  );
}
