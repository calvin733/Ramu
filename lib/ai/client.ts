import type { VerifiedContext } from "@/lib/insights";
export async function requestExplanation(
  route: "explain" | "chat",
  context: VerifiedContext,
  question?: string,
): Promise<{ text: string; mode: "basic" | "gemini" }> {
  try {
    const response = await fetch(`/api/ai/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, question }),
      signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) return { text: context.fallback, mode: "basic" };
    const result: unknown = await response.json();
    if (
      typeof result === "object" &&
      result !== null &&
      "text" in result &&
      typeof result.text === "string" &&
      "mode" in result &&
      (result.mode === "basic" || result.mode === "gemini")
    )
      return { text: result.text, mode: result.mode };
  } catch {
    /* Deterministic explanations remain available during outages. */
  }
  return { text: context.fallback, mode: "basic" };
}
