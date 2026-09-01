import { getSessionUserId } from "@/lib/session";
import { getUserTransactions } from "@/lib/services/view-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const portfolioId = new URL(request.url).searchParams.get("portfolio");
  const txs = await getUserTransactions(userId, portfolioId ?? undefined);

  const rows = txs.map((tx) => ({
    date: tx.occurredAt.toISOString().slice(0, 10),
    symbol: tx.asset.symbol,
    name: tx.asset.name,
    asset_type: tx.asset.type,
    type: tx.type,
    quantity: parseFloat(tx.quantity),
    price: parseFloat(tx.price),
    fee: parseFloat(tx.fee),
    currency: tx.asset.currency,
    market: tx.asset.market,
    note: tx.note ?? "",
  }));

  return new Response(JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions.json"',
    },
  });
}
