import { Side } from "@polymarket/clob-client-v2";
import { availableAtBest, isFresh } from "./books.js";
import type { BotConfig, EnrichedMarket, TradingSignal } from "./types.js";

export function findSignals(markets: EnrichedMarket[], config: BotConfig): TradingSignal[] {
  return [
    ...findNearZeroYesSignals(markets, config),
    ...findNegRiskSellBasketSignals(markets, config)
  ].sort((left, right) => {
    const leftTime = getSignalEndDate(left);
    const rightTime = getSignalEndDate(right);
    if (leftTime !== rightTime) {
      if (leftTime === Infinity) return 1;
      if (rightTime === Infinity) return -1;
      return leftTime - rightTime;
    }
    return right.score - left.score;
  });
}

function getSignalEndDate(signal: TradingSignal): number {
  let minTime = Infinity;
  for (const leg of signal.legs) {
    if (leg.market.endDate) {
      const time = Date.parse(leg.market.endDate);
      if (!isNaN(time) && time < minTime) {
        minTime = time;
      }
    }
  }
  return minTime;
}

export function findNearZeroYesSignals(
  markets: EnrichedMarket[],
  config: Pick<BotConfig, "nearZeroYesMaxBid" | "minBookSize" | "maxSpread" | "staleBookMs">
): TradingSignal[] {
  const now = Date.now();

  return markets.flatMap((market) => {
    const yesBid = market.yesBook?.bestBid;
    const yesAsk = market.yesBook?.bestAsk;

    if (!market.yesToken || !yesBid || !isFresh(market.yesBook, config.staleBookMs, now)) {
      return [];
    }

    if (yesBid.price <= 0 || yesBid.price > config.nearZeroYesMaxBid) {
      return [];
    }

    if (availableAtBest(yesBid) < Math.max(config.minBookSize, market.minOrderSize)) {
      return [];
    }

    const spread = yesAsk ? yesAsk.price - yesBid.price : market.spread;
    if (spread !== undefined && spread > config.maxSpread) {
      return [];
    }

    const edge = yesBid.price;
    const depthScore = Math.min(1, yesBid.size / 1_000);
    const score = edge * 100 + depthScore;
    const label = market.groupItemTitle ? `${market.groupItemTitle}: ${market.question}` : market.question;

    return [
      {
        id: `near-zero:${market.marketId}:${market.yesToken.tokenId}:${yesBid.price}`,
        kind: "near_zero_yes",
        title: market.question,
        edge,
        score,
        reason: `YES best bid is ${formatPercent(yesBid.price)} with ${yesBid.size.toFixed(2)} shares at the top of book.`,
        createdAt: new Date(now).toISOString(),
        legs: [
          {
            market,
            tokenId: market.yesToken.tokenId,
            outcome: "YES",
            side: Side.SELL,
            price: yesBid.price,
            availableSize: yesBid.size
          }
        ]
      } satisfies TradingSignal
    ];
  });
}

export function findNegRiskSellBasketSignals(
  markets: EnrichedMarket[],
  config: Pick<BotConfig, "correlationEdgeMin" | "minBookSize" | "staleBookMs">
): TradingSignal[] {
  const now = Date.now();
  const groups = new Map<string, EnrichedMarket[]>();

  for (const market of markets) {
    const groupId = market.negRiskMarketId ?? (market.negRisk ? market.eventSlug : undefined);
    if (!groupId || !market.yesToken || !isFresh(market.yesBook, config.staleBookMs, now)) {
      continue;
    }

    const bucket = groups.get(groupId) ?? [];
    bucket.push(market);
    groups.set(groupId, bucket);
  }

  const signals: TradingSignal[] = [];

  for (const [groupId, groupMarkets] of groups) {
    const legs = groupMarkets
      .map((market) => {
        const bid = market.yesBook?.bestBid;
        if (!bid || bid.size < Math.max(config.minBookSize, market.minOrderSize) || !market.yesToken) {
          return undefined;
        }
        return {
          market,
          tokenId: market.yesToken.tokenId,
          outcome: "YES" as const,
          side: Side.SELL,
          price: bid.price,
          availableSize: bid.size
        };
      })
      .filter((leg): leg is NonNullable<typeof leg> => leg !== undefined)
      .sort((left, right) => right.price - left.price);

    if (legs.length < 2) {
      continue;
    }

    const sumBids = legs.reduce((sum, leg) => sum + leg.price, 0);
    const edge = sumBids - 1;

    if (edge <= config.correlationEdgeMin) {
      continue;
    }

    signals.push({
      id: `neg-risk-basket:${groupId}:${sumBids.toFixed(4)}`,
      kind: "neg_risk_sell_basket",
      title: legs[0]?.market.eventTitle || groupId,
      edge,
      score: edge * 100 + Math.min(10, legs.length),
      reason: `Sum of sellable YES bids is ${sumBids.toFixed(4)}, above 1.0000 by ${edge.toFixed(4)} before fees and execution risk.`,
      createdAt: new Date(now).toISOString(),
      legs
    });
  }

  return signals;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}
