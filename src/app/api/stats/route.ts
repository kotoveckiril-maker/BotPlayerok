import { apiAuth } from "@/lib/auth";
import { getStats } from "@/lib/bot/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await apiAuth(req);
  if (auth) return auth;

  const range = Number(new URL(req.url).searchParams.get("range")) || 7;
  try {
    const stats = await getStats(range);
    return Response.json(stats);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
