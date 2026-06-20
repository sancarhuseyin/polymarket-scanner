import { Side } from "@polymarket/clob-client-v2";
import { describe, expect, it } from "vitest";
import { buildTradeIntents } from "../src/intents.js";
import { findSignals, findNearZeroYesSignals, findNegRiskSellBasketSignals } from "../src/strategies.js";
import type { BotConfig, BookSnapshot, EnrichedMarket } from "../src/types.js";

const baseConfig: BotConfig = {
  gammaApiBase: "https://gamma-api.polymarket.com",
  clobApiBase: "https://clob.polymarket.com",
  botMode: "paper",
  liveTrading: false,
  confirmLiveTrading: "",
  pollIntervalMs: 30_000,
  maxMarkets: 100,
  minLiquidity: 0,
  minVolume24h: 0,
  sportsOnly: false,
  nearZeroYesMaxBid: 0.02,
  minBookSize: 5,
  maxSpread: 0.03,
  correlationEdgeMin: 0.04,
  staleBookMs: 60_000,
  orderNotionalUsd: 2,
  maxOrderNotionalUsd: 5,
  maxSettlementRiskUsd: 5,
  maxDailyNotionalUsd: 25,
  maxOpenOrders: 10,
  sellYesRequiresInventory: true,
  executionStyle: "sell_yes",
  executeBaskets: false,
  output: "text"
};

describe("strategies", () => {
  it("finds a near-zero YES sell signal", () => {
    const signals = findNearZeroYesSignals([market("a", 0.01, 0.02)], baseConfig);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.legs[0]?.side).toBe(Side.SELL);
    expect(signals[0]?.legs[0]?.price).toBe(0.01);
  });

  it("finds a neg-risk basket when mutually exclusive YES bids sum above 1", () => {
    const signals = findNegRiskSellBasketSignals(
      [market("a", 0.55, 0.56), market("b", 0.51, 0.52)],
      baseConfig
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]?.edge).toBeCloseTo(0.06);
  });

  it("caps SELL YES size by settlement risk, not tiny notional", () => {
    const signals = findNearZeroYesSignals([market("a", 0.01, 0.02)], baseConfig);
    const [intent] = buildTradeIntents(signals, baseConfig);

    expect(intent?.side).toBe(Side.SELL);
    expect(intent?.size).toBe(5.05);
    expect(intent?.maxSettlementRiskUsd).toBeLessThanOrEqual(5.01);
  });

  it("sorts signals by endDate ascending (soonest first)", () => {
    const marketA = market("a", 0.01, 0.02);
    marketA.endDate = "2026-07-15T00:00:00Z";

    const marketB = market("b", 0.01, 0.02);
    marketB.endDate = "2026-06-25T00:00:00Z";

    const marketC = market("c", 0.01, 0.02);
    marketC.endDate = undefined;

    const signals = findSignals([marketA, marketB, marketC], baseConfig);
    expect(signals).toHaveLength(3);
    // B resolves soonest (June), then A (July), then C (no date)
    expect(signals[0]?.legs[0]?.market.marketId).toBe("b");
    expect(signals[1]?.legs[0]?.market.marketId).toBe("a");
    expect(signals[2]?.legs[0]?.market.marketId).toBe("c");
  });
});

function market(id: string, bid: number, ask: number): EnrichedMarket {
  const yesTokenId = `${id}-yes`;
  const noTokenId = `${id}-no`;
  return {
    eventId: "event",
    eventSlug: "event",
    eventTitle: "Mutually exclusive group",
    eventTags: ["Sports"],
    marketId: id,
    conditionId: `condition-${id}`,
    question: `Will ${id} win?`,
    slug: `will-${id}-win`,
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    liquidity: 1000,
    volume24h: 100,
    minOrderSize: 5,
    tickSize: "0.01",
    negRisk: true,
    negRiskMarketId: "group",
    outcomes: [
      { outcome: "Yes", tokenId: yesTokenId, price: bid },
      { outcome: "No", tokenId: noTokenId, price: 1 - bid }
    ],
    yesToken: { outcome: "Yes", tokenId: yesTokenId, price: bid },
    noToken: { outcome: "No", tokenId: noTokenId, price: 1 - bid },
    yesBook: book(yesTokenId, bid, ask),
    noBook: book(noTokenId, 1 - ask, 1 - bid)
  };
}

function book(tokenId: string, bid: number, ask: number): BookSnapshot {
  return {
    tokenId,
    market: "condition",
    timestampMs: Date.now(),
    bids: [{ price: bid, size: 100 }],
    asks: [{ price: ask, size: 100 }],
    bestBid: { price: bid, size: 100 },
    bestAsk: { price: ask, size: 100 },
    spread: ask - bid,
    minOrderSize: 5,
    tickSize: "0.01",
    negRisk: true,
    raw: {
      market: "condition",
      asset_id: tokenId,
      timestamp: String(Date.now()),
      bids: [{ price: String(bid), size: "100" }],
      asks: [{ price: String(ask), size: "100" }],
      min_order_size: "5",
      tick_size: "0.01",
      neg_risk: true,
      hash: "hash",
      last_trade_price: String(bid)
    }
  };
}
