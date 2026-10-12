export const MAX_GLASS_CONTEXTS = 2;

export function canUseLiquidGlass({
  width,
  reducedMotion,
  finePointer,
  saveData,
  memory,
  cores,
}: {
  width: number;
  reducedMotion: boolean;
  finePointer: boolean;
  saveData?: boolean;
  memory?: number;
  cores?: number;
}) {
  return (
    width >= 900 &&
    !reducedMotion &&
    finePointer &&
    !saveData &&
    (memory === undefined || memory >= 4) &&
    (cores === undefined || cores >= 4)
  );
}

const contexts = new Set<symbol>();
export function acquireGlassSlot() {
  if (contexts.size >= MAX_GLASS_CONTEXTS) return null;
  const slot = Symbol("ramu-glass");
  contexts.add(slot);
  return () => {
    contexts.delete(slot);
  };
}
