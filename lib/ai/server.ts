import "server-only";
import { BUSINESS_INSTRUCTION as instruction } from "./instructions";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { verifiedAnswerSchema } from "@/lib/queries/model";
import { prepareChatFacts, prepareExplanationContext } from "@/lib/ai/chat-facts";
import { handleConversation } from "@/lib/chat/server";
import {
  GEMINI_MODEL,
  logGeminiError,
  logGeminiRequest,
} from "@/lib/ai/config";

const amount = z.number().finite().nonnegative().max(1e30);
const signed = z.number().finite().min(-1e30).max(1e30);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const name = z.string().min(1).max(200);
const product = z
  .object({
    name,
    revenue: amount,
    units: amount.nullable(),
    cogs: amount.nullable(),
    grossProfit: signed.nullable(),
    margin: signed.nullable(),
    contribution: signed,
    growth: signed.nullable(),
  })
  .strict();
const insight = z
  .object({
    id: name,
    kind: z.enum(["opportunity", "warning", "performance"]),
    title: name,
    body: z.string().max(2000),
    action: z.string().max(2000),
  })
  .strict();
const contextSchema = z
  .object({
    answer: verifiedAnswerSchema.optional(),
    channels: z
      .array(
        z
          .object({ name, revenue: amount, contribution: signed.nullable() })
          .strict(),
      )
      .max(8)
      .optional(),
    overview: z
      .object({
        revenue: amount,
        orders: amount.int().nullable(),
        units: amount.nullable(),
        aov: amount.nullable(),
        grossProfit: signed.nullable(),
        grossMargin: signed.nullable(),
        revenueGrowth: signed.nullable(),
        cogsCoverage: z.number().min(0).max(100),
        period: z
          .object({
            start: date,
            end: date,
            days: z.number().int().min(1).max(30),
            previousStart: date.nullable(),
            previousEnd: date.nullable(),
          })
          .strict(),
      })
      .strict(),
    expenses: amount.nullable(),
    goals: z
      .array(
        z
          .object({
            metric: z.enum([
              "revenue",
              "orders",
              "units",
              "grossProfit",
              "netProfit",
            ]),
            period: z.enum(["daily", "monthly", "yearly"]),
            target: amount.positive(),
            actual: signed.nullable(),
            progressPercentage: signed.nullable(),
            remaining: amount.nullable(),
            expectedProgressToDate: amount.max(100),
            paceStatus: z
              .enum(["ahead", "on-track", "behind", "completed"])
              .nullable(),
            requiredRemainingPace: amount.nullable(),
            daysRemaining: amount.int().max(366),
            periodStart: date,
            periodEnd: date,
            referenceDate: date,
            missing: z.string().max(500).nullable(),
            supportingProducts: z
              .array(
                z
                  .object({ name, revenue: amount, contribution: signed })
                  .strict(),
              )
              .max(3),
          })
          .strict(),
      )
      .max(8)
      .optional(),
    intent: z.enum([
      "goal_progress",
      "goal_remaining",
      "goal_pace",
      "goal_status",
      "goal_supporting_products",
      "overview",
      "revenue",
      "profit",
      "bestseller",
      "profitable",
      "margin",
      "growth",
      "warnings",
      "unknown",
    ]),
    products: z.array(product).max(8),
    insights: z.array(insight).max(4),
    fallback: z.string().min(1).max(12000),
  })
  .strict();
const inputSchema = z
  .object({
    context: contextSchema,
    question: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const decoder = new TextDecoder();
  let content = "",
    size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new Error("large");
    }
    content += decoder.decode(value, { stream: true });
  }
  return JSON.parse(content + decoder.decode());
}

export async function handleAi(
  request: Request,
  route: "chat" | "explain" | "goals",
) {
  let body: z.infer<typeof inputSchema>;
  try {
    const value = await readBody(request);
    if (
      route === "chat" &&
      value &&
      typeof value === "object" &&
      "kind" in value &&
      value.kind === "conversation"
    )
      return handleConversation(value);
    body = inputSchema.parse(value);
  } catch {
    return Response.json(
      {
        error:
          "Jawaban belum bisa disiapkan. Muat kembali data bisnis Anda, lalu coba lagi.",
      },
      { status: 400 },
    );
  }
  if (route === "chat" && !body.question)
    return Response.json(
      { error: "Tuliskan pertanyaan Anda terlebih dahulu." },
      { status: 400 },
    );
  const fallback = { text: body.context.fallback, mode: "basic" };
  const key = process.env.GEMINI_API_KEY;
  if (
    route === "chat" &&
    (!body.context.answer ||
      body.context.answer.status !== "answered" ||
      !body.context.answer.facts.length)
  )
    return Response.json(fallback);
  logGeminiRequest(route);
  if (!key) return Response.json(fallback);
  let phase: "request" | "response" = "request";
  try {
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: 12000 },
    });
    const chat =
      route === "chat" && body.context.answer
        ? prepareChatFacts(body.context.answer, body.context.overview.period)
        : null;
    const explanation=chat ? null : prepareExplanationContext(body.context);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: JSON.stringify(
        chat
          ? chat.payload
          : {
              question:
                route === "chat"
                  ? body.question
                  : route === "goals"
                    ? "Jelaskan progress target terverifikasi, sisa target, dan langkah yang dapat dipertimbangkan berdasarkan bukti. Jangan menghitung angka baru atau menjamin hasil."
                    : "Jelaskan performa bisnis dan insight yang disediakan, tanpa menghitung angka baru.",
              verifiedMetrics: explanation!.payload,
            },
      ),
      config: {
        systemInstruction: instruction,
        temperature: 0.15,
        maxOutputTokens: 1500,
      },
    });
    phase = "response";
    const text = response.text?.trim();
    if (!text) throw new Error("Empty Gemini response");
    return Response.json({
      text: (chat ? chat.restore(text) : explanation!.restore(text)).slice(0, 12000),
      mode: "gemini",
    });
  } catch (error) {
    logGeminiError(route, error, phase);
    return Response.json(fallback);
  }
}
