import { Side } from "@polymarket/clob-client-v2";
import type { BotConfig, SignalLeg, TradeIntent, TradingSignal } from "./types.js";

export function buildTradeIntents(signals: TradingSignal[], config: BotConfig): TradeIntent[] {
  const intents: TradeIntent[] = [];

  for (const signal of signals) {
    if (signal.kind === "neg_risk_sell_basket" && !config.executeBaskets) {
      continue;
    }

    if (signal.kind === "neg_risk_sell_basket") {
      intents.push(...buildBasketIntents(signal, config));
      continue;
    }

    const leg = signal.legs[0];
    if (!leg) {
      continue;
    }

    const intent = config.executionStyle === "buy_no_proxy"
      ? buildBuyNoProxyIntent(signal, leg, config)
      : buildSellYesIntent(signal, leg, config);

    if (intent) {
      intents.push(intent);
    }
  }

  return intents;
}

function buildSellYesIntent(signal: TradingSignal, leg: SignalLeg, config: BotConfig): TradeIntent | undefined {
  const maxByRisk = config.maxSettlementRiskUsd / Math.max(1 - leg.price, 0.0001);
  const maxByNotional = config.maxOrderNotionalUsd / leg.price;
  const size = floorSize(Math.min(leg.availableSize, maxByRisk, maxByNotional));

  if (size < Math.max(config.minBookSize, leg.market.minOrderSize)) {
    return undefined;
  }

  return {
    signalId: signal.id,
    signalKind: signal.kind,
    description: signal.title,
    tokenId: leg.tokenId,
    side: Side.SELL,
    price: leg.price,
    size,
    notionalUsd: size * leg.price,
    maxSettlementRiskUsd: size * (1 - leg.price),
    tickSize: leg.market.tickSize,
    negRisk: leg.market.negRisk,
    marketQuestion: leg.market.question,
    marketSlug: leg.market.slug,
    dryRun: !config.liveTrading
  };
}

function buildBuyNoProxyIntent(signal: TradingSignal, leg: SignalLeg, config: BotConfig): TradeIntent | undefined {
  const market = leg.market;
  const noAsk = market.noBook?.bestAsk;
  if (!market.noToken || !noAsk || noAsk.size <= 0) {
    return undefined;
  }

  const spend = Math.min(config.orderNotionalUsd, config.maxOrderNotionalUsd, noAsk.size * noAsk.price);
  const size = floorSize(spend / noAsk.price);

  if (size < Math.max(config.minBookSize, market.minOrderSize)) {
    return undefined;
  }

  return {
    signalId: signal.id,
    signalKind: signal.kind,
    description: `${signal.title} via BUY NO proxy`,
    tokenId: market.noToken.tokenId,
    side: Side.BUY,
    price: noAsk.price,
    size,
    notionalUsd: size * noAsk.price,
    maxSettlementRiskUsd: size * noAsk.price,
    tickSize: market.tickSize,
    negRisk: market.negRisk,
    marketQuestion: market.question,
    marketSlug: market.slug,
    dryRun: !config.liveTrading
  };
}

function buildBasketIntents(signal: TradingSignal, config: BotConfig): TradeIntent[] {
  if (signal.legs.length < 2) {
    return [];
  }

  const minAvailable = Math.min(...signal.legs.map((leg) => leg.availableSize));
  const maxPrice = Math.max(...signal.legs.map((leg) => leg.price));
  const maxByRisk = config.maxSettlementRiskUsd / Math.max(1 - maxPrice, 0.0001);
  const size = floorSize(Math.min(minAvailable, maxByRisk));

  if (!Number.isFinite(size) || size < config.minBookSize) {
    return [];
  }

  return signal.legs.map((leg) => ({
    signalId: signal.id,
    signalKind: signal.kind,
    description: signal.title,
    tokenId: leg.tokenId,
    side: Side.SELL,
    price: leg.price,
    size,
    notionalUsd: size * leg.price,
    maxSettlementRiskUsd: size * (1 - leg.price),
    tickSize: leg.market.tickSize,
    negRisk: leg.market.negRisk,
    marketQuestion: leg.market.question,
    marketSlug: leg.market.slug,
    dryRun: !config.liveTrading
  }));
}

function floorSize(value: number): number {
  return Math.floor(value * 100) / 100;
}
