import { handleAi } from "@/lib/ai/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleAi(request, "explain");
}
