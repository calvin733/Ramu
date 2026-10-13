import type { BusinessMetrics, ChatMessage, UploadedData } from "@/lib/types";
import { EntityRegistry, ALIAS_PATTERN } from "./privacy";
import {
  MAX_RECENT_TURNS,
  type BusinessQueryPlan,
  type BusinessSnapshot,
  type RamuConversationState,
} from "./model";

export const emptyConversation = (): RamuConversationState => ({
  recentTurns: [],
  lastPlan: null,
  activeTopics: [],
  referencedEntities: [],
  focusEntities: [],
  lastReferencedFacts: [],
});
export function rememberTurn(
  state: RamuConversationState,
  question: string,
  answer: string,
  plan: BusinessQueryPlan,
  snapshot: BusinessSnapshot,
): RamuConversationState {
  const mentioned = [...new Set(answer.match(ALIAS_PATTERN) ?? [])].slice(0, 8);
  const focusEntities =
    mentioned.length || plan.requests.length ? mentioned : state.focusEntities;
  const referencedEntities = [
    ...new Set([...state.referencedEntities, ...focusEntities]),
  ].slice(-8);
  return {
    recentTurns: [
      ...state.recentTurns,
      { role: "user" as const, content: question.slice(0, 2400) },
      { role: "assistant" as const, content: answer.slice(0, 2400) },
    ].slice(-MAX_RECENT_TURNS),
    lastPlan: plan.requests.length ? plan : state.lastPlan,
    activeTopics: plan.requests.length
      ? [...new Set(plan.requests.map((r) => r.topic))]
      : state.activeTopics,
    referencedEntities,
    focusEntities,
    lastReferencedFacts: snapshot.facts
      .filter((f) => !f.entity || focusEntities.includes(f.entity))
      .slice(0, 16)
      .map(
        (f) =>
          `${f.entity ?? f.topic}:${f.field}${f.goal ? `:${f.goal.metric}:${f.goal.period}:${f.goal.start}` : f.bucket ? `:${f.bucket.unit}:${f.bucket.date}` : ""}`,
      ),
  };
}
export function createChatSession(
  data: UploadedData,
  metrics: BusinessMetrics,
) {
  const registry = new EntityRegistry(data, metrics);
  const initial = {
    memory: emptyConversation(),
    messages: [] as ChatMessage[],
    sending: false,
  };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    id: crypto.randomUUID(),
    registry,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (next: Partial<typeof initial>) => {
      snapshot = { ...snapshot, ...next };
      listeners.forEach((listener) => listener());
    },
  };
}
export type ChatSession = ReturnType<typeof createChatSession>;
