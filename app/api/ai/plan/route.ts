import { handlePlanner } from "@/lib/chat/server";
import { readBody } from "@/lib/ai/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return await handlePlanner(await readBody(request));
  } catch {
    return Response.json(
      { error: "Pertanyaan belum bisa dibaca. Coba lagi." },
      { status: 400 },
    );
  }
}
