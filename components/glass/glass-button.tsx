import { Button, type ButtonProps } from "@/components/ui/button";

// WebGL is opt-in for key controls; every other button keeps the CSS hierarchy.
export function GlassButton(props: Omit<ButtonProps, "liquid">) {
  return <Button {...props} liquid />;
}
