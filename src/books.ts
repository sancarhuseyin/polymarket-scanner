import { Chain, ClobClient, type OrderBookSummary } from "@polymarket/clob-client-v2";
import type { BookLevel, BookSnapshot, BotConfig, EnrichedMarket, MarketSnapshot } from "./types.js";

export class ClobBookClient {
  private readonly client: ClobClient;

  constructor(config: BotConfig) {
    this.client = new ClobClient({
      host: config.clobApiBase,
      chain: Chain.POLYGON,
      throwOnError: true,
      retryOnError: true
    });
  }

  async enrichMarkets(markets: MarketSnapshot[], concurrency = 8): Promise<EnrichedMarket[]> {
    return mapLimit(markets, concurrency, async (market) => {
      const [yesBook, noBook] = await Promise.all([
        market.yesToken ? this.fetchBook(market.yesToken.tokenId).catch(() => undefined) : undefined,
        market.noToken ? this.fetchBook(market.noToken.tokenId).catch(() => undefined) : undefined
      ]);

      return {
        ...market,
        yesBook,
        noBook
      };
    });
  }

  async fetchBook(tokenId: string): Promise<BookSnapshot> {
    return normalizeBook(await this.client.getOrderBook(tokenId));
  }
}

export function normalizeBook(book: OrderBookSummary): BookSnapshot {
  const bids = normalizeLevels(book.bids).sort((left, right) => right.price - left.price);
  const asks = normalizeLevels(book.asks).sort((left, right) => left.price - right.price);
  const bestBid = bids[0];
  const bestAsk = asks[0];
  const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : undefined;

  return {
    tokenId: book.asset_id,
    market: book.market,
    timestampMs: Number(book.timestamp),
    bids,
    asks,
    bestBid,
    bestAsk,
    spread,
    minOrderSize: Number(book.min_order_size),
    tickSize: toTickSize(book.tick_size),
    negRisk: book.neg_risk,
    raw: book
  };
}

export function isFresh(book: BookSnapshot | undefined, staleBookMs: number, now = Date.now()): boolean {
  return Boolean(book && Number.isFinite(book.timestampMs) && now - book.timestampMs <= staleBookMs);
}

export function availableAtBest(level: BookLevel | undefined): number {
  return level?.size ?? 0;
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await worker(values[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => run()));
  return results;
}

function normalizeLevels(levels: OrderBookSummary["bids"]): BookLevel[] {
  return levels
    .map((level) => ({
      price: Number(level.price),
      size: Number(level.size)
    }))
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0);
}

function toTickSize(value: string): BookSnapshot["tickSize"] {
  if (value === "0.1" || value === "0.01" || value === "0.001" || value === "0.0001") {
    return value;
  }
  return "0.01";
}
