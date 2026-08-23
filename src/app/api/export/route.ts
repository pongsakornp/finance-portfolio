import { getSessionUserId } from "@/lib/session";
import { getUserTransactions } from "@/lib/services/view-service";
import { toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

const HEADER = [
  "date",
  "symbol",
  "asset_type",
  "action",
  "quantity",
  "price",
  "fee",
  "currency",
  "note",
];

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const txs = await getUserTransactions(userId);
  const rows = txs.map((tx) => [
    tx.occurredAt.toISOString().slice(0, 10),
    tx.asset.symbol,
    tx.asset.type,
    tx.type,
    parseFloat(tx.quantity),
    parseFloat(tx.price),
    parseFloat(tx.fee),
    tx.asset.currency,
    tx.note ?? "",
  ]);

  return new Response(toCsv([HEADER, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
}
