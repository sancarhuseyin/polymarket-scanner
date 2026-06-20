import type { EnrichedMarket, ExecutionResult, TradeIntent, TradingSignal } from "./types.js";

export interface ScanReport {
  scannedMarkets: number;
  bookMarkets: number;
  signals: TradingSignal[];
  intents: TradeIntent[];
  executions?: ExecutionResult[];
}

export function printReport(report: ScanReport): void {
  console.log(
    `[${new Date().toISOString()}] markets=${report.scannedMarkets} books=${report.bookMarkets} signals=${report.signals.length} intents=${report.intents.length}`
  );

  for (const signal of report.signals.slice(0, 20)) {
    const legs = signal.legs
      .slice(0, 4)
      .map((leg) => `${leg.side} ${leg.outcome} ${leg.price.toFixed(4)} ${shorten(leg.market.question, 70)}`)
      .join(" | ");
    console.log(`${signal.kind} edge=${signal.edge.toFixed(4)} score=${signal.score.toFixed(2)} ${signal.reason}`);
    console.log(`  ${legs}`);
  }

  if (report.executions?.length) {
    for (const result of report.executions) {
      console.log(`${result.status}: ${result.message}`);
    }
  }
}

export function printJson(report: ScanReport): void {
  console.log(JSON.stringify(serializeReport(report), null, 2));
}

export function countMarketsWithBooks(markets: EnrichedMarket[]): number {
  return markets.filter((market) => market.yesBook || market.noBook).length;
}

export function serializeReport(report: ScanReport): unknown {
  return {
    scannedMarkets: report.scannedMarkets,
    bookMarkets: report.bookMarkets,
    signals: report.signals.map(serializeSignal),
    intents: report.intents,
    executions: report.executions
  };
}

export function serializeSignal(signal: TradingSignal): unknown {
  return {
    id: signal.id,
    kind: signal.kind,
    title: signal.title,
    edge: signal.edge,
    score: signal.score,
    reason: signal.reason,
    createdAt: signal.createdAt,
    legs: signal.legs.map((leg) => ({
      marketId: leg.market.marketId,
      eventTitle: leg.market.eventTitle,
      groupItemTitle: leg.market.groupItemTitle,
      question: leg.market.question,
      slug: leg.market.slug,
      tokenId: leg.tokenId,
      outcome: leg.outcome,
      side: leg.side,
      price: leg.price,
      availableSize: leg.availableSize,
      spread: leg.market.yesBook?.spread,
      bestAsk: leg.market.yesBook?.bestAsk?.price,
      liquidity: leg.market.liquidity,
      volume24h: leg.market.volume24h,
      minOrderSize: leg.market.minOrderSize,
      tickSize: leg.market.tickSize,
      negRisk: leg.market.negRisk,
      endDate: leg.market.endDate,
      eventSlug: leg.market.eventSlug,
      eventTags: leg.market.eventTags || []
    }))
  };
}

function shorten(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
