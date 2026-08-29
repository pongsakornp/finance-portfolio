import Decimal from "decimal.js";

export type TxLike = {
  type: "buy" | "sell" | "dividend";
  quantity: string | number;
  price: string | number;
  fee: string | number;
};

export type Position = {
  qty: number;
  avgCost: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  realizedPL: number;
  dividendsReceived: number;
};

const r2 = (x: Decimal) => x.toDecimalPlaces(2).toNumber();
const r6 = (x: Decimal) => x.toDecimalPlaces(6).toNumber();

/**
 * Average-cost method. Transactions MUST be pre-sorted oldest → newest.
 * Pure function — no DB, no IO. All amounts in the asset's native currency.
 * For dividends, `quantity` carries the cash amount paid.
 */
export function computePosition(
  txs: TxLike[],
  currentPrice: number | null | undefined
): Position {
  let qty = new Decimal(0);
  let cost = new Decimal(0); // open cost basis
  let realized = new Decimal(0);
  let dividends = new Decimal(0);

  for (const tx of txs) {
    const q = new Decimal(tx.quantity);
    const p = new Decimal(tx.price);
    const fee = new Decimal(tx.fee ?? 0);

    if (tx.type === "buy") {
      qty = qty.plus(q);
      cost = cost.plus(q.mul(p)).plus(fee);
    } else if (tx.type === "sell") {
      if (qty.lte(0)) continue; // oversell guard: ignore phantom sells
      const sellQty = Decimal.min(q, qty);
      const avg = cost.div(qty);
      realized = realized.plus(sellQty.mul(p.minus(avg))).minus(fee);
      cost = cost.minus(avg.mul(sellQty));
      qty = qty.minus(sellQty);
      if (qty.isZero()) cost = new Decimal(0); // kill float dust on full close
    } else {
      // dividend: cash amount stored in `quantity`
      dividends = dividends.plus(q);
    }
  }

  const price = new Decimal(currentPrice ?? 0);
  const hasPrice = currentPrice !== null && currentPrice !== undefined;
  const mv = qty.mul(price);
  const unrealized = hasPrice ? mv.minus(cost) : new Decimal(0);

  return {
    qty: r6(qty),
    avgCost: qty.gt(0) ? r6(cost.div(qty)) : 0,
    costBasis: r2(cost),
    currentPrice: hasPrice ? r6(price) : 0,
    marketValue: r2(mv),
    unrealizedPL: r2(unrealized),
    unrealizedPLPct:
      hasPrice && cost.gt(0)
        ? parseFloat(unrealized.div(cost).mul(100).toDecimalPlaces(2).toString())
        : 0,
    realizedPL: r2(realized),
    dividendsReceived: r2(dividends),
  };
}

export type Totals = {
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  realizedPL: number;
  dividendsReceived: number;
  dayChange: number;
  dayChangePct: number;
};

export function computeTotals(
  positions: Array<{ position: Position; previousClose: number | null }>
): Totals {
  const sum = (pick: (p: Position) => number) =>
    positions.reduce((acc, { position }) => acc + pick(position), 0);

  const mv = sum((p) => p.marketValue);
  const cost = sum((p) => p.costBasis);
  const unrealized = mv - cost;
  let dayChange = 0;
  for (const { position, previousClose } of positions) {
    if (previousClose !== null && position.qty > 0) {
      dayChange += (position.currentPrice - previousClose) * position.qty;
    }
  }
  const prevMv = mv - dayChange;

  return {
    marketValue: r2(new Decimal(mv)),
    costBasis: r2(new Decimal(cost)),
    unrealizedPL: r2(new Decimal(unrealized)),
    unrealizedPLPct: cost > 0 ? parseFloat(((unrealized / cost) * 100).toFixed(2)) : 0,
    realizedPL: r2(new Decimal(sum((p) => p.realizedPL))),
    dividendsReceived: r2(new Decimal(sum((p) => p.dividendsReceived))),
    dayChange: r2(new Decimal(dayChange)),
    dayChangePct: prevMv > 0 ? parseFloat(((dayChange / prevMv) * 100).toFixed(2)) : 0,
  };
}

/** Hypothetical sell at current price — pure, records nothing. Assumes zero fee. */
export function whatIfSell(position: Position, quantity: number) {
  const q = new Decimal(Math.min(quantity, position.qty));
  const price = new Decimal(position.currentPrice);
  const avg = new Decimal(position.avgCost);
  return {
    sellQty: r6(q),
    remainingQty: r6(Decimal.max(new Decimal(position.qty).minus(q), 0)),
    estimatedProceeds: r2(q.mul(price)),
    estimatedRealizedPL: r2(q.mul(price.minus(avg))),
  };
}
