import { z } from "zod";

import { getSessionUserId } from "@/lib/session";
import { getPortfolioHoldingsSnapshot } from "@/lib/services/portfolio-export-service";

export const dynamic = "force-dynamic";

function filenamePart(name: string) {
  const part = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return part || "portfolio";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  try {
    const snapshot = await getPortfolioHoldingsSnapshot(userId, id);
    const date = snapshot.exportedAt.slice(0, 10);
    const filename = `${filenamePart(snapshot.portfolio.name)}-holdings-${date}.json`;
    return new Response(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Portfolio not found") {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Unable to export portfolio", { status: 500 });
  }
}
