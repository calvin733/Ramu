import { z } from "zod";
import type { BusinessMetrics } from "@/lib/types";
import type { GoalProgress } from "@/lib/goals";
import { preparePlan, acceptPlan } from "./planning";
import { retrievePlan } from "./retrieval";
import { ALIAS_PATTERN } from "./privacy";
import { rememberTurn, type ChatSession } from "./session";
import { conversationInputSchema } from "./model";

const responseSchema = z
  .object({ text: z.string().max(12000), mode: z.enum(["gemini", "basic"]) })
  .strict();
export async function requestChatTurn(
  question: string,
  metrics: BusinessMetrics,
  goals: GoalProgress[],
  session: ChatSession,
) {
  const memory = session.getSnapshot().memory;
  const prepared = preparePlan(
    question,
    metrics,
    goals,
    session.registry,
    memory,
  );
  let plan = prepared.fallback;
  if (prepared.needsPlanner) {
    try {
      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared.planner),
        signal: AbortSignal.timeout(16000),
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (
          result &&
          typeof result === "object" &&
          "plan" in result &&
          result.plan
        )
          plan = acceptPlan(result.plan, prepared.planner, prepared.fallback);
      }
    } catch {
      /* A provider/planner failure does not block local business answers. */
    }
  }
  const { snapshot, fallback } = retrievePlan(
    plan,
    metrics,
    goals,
    session.registry,
  );
  const aliasFallback = session.registry.sanitize(fallback);
  const priority = [
    ...snapshot.facts.flatMap((f) => (f.entity ? [f.entity] : [])),
    ...plan.requests.flatMap((r) => r.entities),
    ...(prepared.planner.question.match(ALIAS_PATTERN) ?? []),
    ...memory.focusEntities,
    ...memory.referencedEntities,
    ...(memory.lastPlan?.requests.flatMap((r) => r.entities) ?? []),
  ];
  const input = conversationInputSchema.parse({
    kind: "conversation",
    question: prepared.planner.question,
    memory,
    plan,
    snapshot,
    catalog: session.registry.catalog(priority),
    fallback: aliasFallback,
  });
  let aliasedText = aliasFallback,
    mode: "basic" | "gemini" = "basic";
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(16000),
    });
    if (response.ok) {
      const result = responseSchema.parse(await response.json());
      if (result.text.trim()) {
        session.registry.restore(result.text);
        aliasedText = session.registry.sanitize(result.text);
        mode = result.mode;
      }
    }
  } catch {
    /* All financial facts and deterministic copy remain available offline. */
  }
  const text = session.registry.restore(aliasedText);
  session.update({
    memory: rememberTurn(
      memory,
      prepared.planner.question,
      aliasedText,
      plan,
      snapshot,
    ),
  });
  return { text, mode };
}
