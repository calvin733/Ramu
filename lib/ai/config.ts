import "server-only";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

type GeminiRoute = "chat" | "explain" | "goals" | "map-data" | "plan";

export function logGeminiRequest(route: GeminiRoute) {
  console.info("[RAMU Gemini]", {
    route: `/api/ai/${route}`,
    model: GEMINI_MODEL,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
}

export function logGeminiError(
  route: GeminiRoute,
  error: unknown,
  phase: "request" | "response" = "request",
) {
  // SDK messages, stacks, and response bodies can echo keys or business data.
  // Log only bounded status codes, known transport codes, and static messages.
  const statusValue =
    error && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  const status =
    typeof statusValue === "number" &&
    Number.isInteger(statusValue) &&
    statusValue >= 100 &&
    statusValue <= 599
      ? statusValue
      : undefined;
  const cause = error instanceof Error ? error.cause : undefined;
  const codeValue =
    cause && typeof cause === "object" && "code" in cause
      ? cause.code
      : undefined;
  const code =
    typeof codeValue === "string" &&
    [
      "EAI_AGAIN",
      "ENOTFOUND",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ].includes(codeValue)
      ? codeValue
      : undefined;
  let message =
    phase === "response"
      ? "Gemini response was empty or invalid."
      : "Gemini request failed.";
  if (status === 400) message = "Gemini rejected the request.";
  if (status === 401 || status === 403)
    message = "Gemini authentication or project access was denied.";
  if (status === 404) message = "Gemini model or endpoint was unavailable.";
  if (status === 429) message = "Gemini quota or rate limit was exceeded.";
  if (status !== undefined && status >= 500)
    message = "Gemini provider service failed.";
  if (
    error instanceof Error &&
    ["AbortError", "TimeoutError"].includes(error.name)
  )
    message = "Gemini request timed out or was aborted.";

  console.error("[RAMU Gemini Error]", {
    route: `/api/ai/${route}`,
    model: GEMINI_MODEL,
    message,
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
  });
}
