import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GlassSurface } from "@/components/glass/glass-surface";
import { GlassPill } from "@/components/glass/glass-pill";
import { GlassButton } from "@/components/glass/glass-button";
import {
  acquireGlassSlot,
  canUseLiquidGlass,
  MAX_GLASS_CONTEXTS,
} from "@/components/glass/policy";

describe("glass enhancement stays optional", () => {
  it("server-renders semantic controls and CSS fallback without browser APIs", () => {
    const html = renderToStaticMarkup(
      createElement(
        GlassSurface,
        { as: "article", strength: "strong", "aria-label": "Target bisnis" },
        createElement(GlassPill, { tone: "amber" }, "Perlu dikejar"),
        createElement(GlassButton, { type: "button" }, "Tambah Target"),
      ),
    );
    expect(html).toContain("<article");
    expect(html).toContain('aria-label="Target bisnis"');
    expect(html).toContain("<button");
    expect(html).toContain("Tambah Target");
    expect(html).toContain('data-glass-state="css"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<canvas");
  });
  const desktop = {
    width: 1440,
    reducedMotion: false,
    finePointer: true,
    memory: 8,
    cores: 8,
  };
  it("allows capable desktop devices", () =>
    expect(canUseLiquidGlass(desktop)).toBe(true));
  it.each([
    { width: 390 },
    { reducedMotion: true },
    { finePointer: false },
    { saveData: true },
    { memory: 2 },
    { cores: 2 },
  ])("uses CSS glass for a constrained device: %j", (constraint) =>
    expect(canUseLiquidGlass({ ...desktop, ...constraint })).toBe(false),
  );
  it("caps contexts at two and releases slots idempotently", () => {
    const slots = Array.from({ length: MAX_GLASS_CONTEXTS }, () =>
      acquireGlassSlot(),
    );
    try {
      expect(slots.every(Boolean)).toBe(true);
      expect(acquireGlassSlot()).toBeNull();
      slots[0]!();
      slots[0]!();
      const replacement = acquireGlassSlot();
      expect(replacement).not.toBeNull();
      replacement!();
    } finally {
      slots.forEach((release) => release?.());
    }
    const next = acquireGlassSlot();
    expect(next).not.toBeNull();
    next!();
  });
});
