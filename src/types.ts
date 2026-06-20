import type { OrderBookSummary, TickSize } from "@polymarket/clob-client-v2";
import type { Side } from "@polymarket/clob-client-v2";

export type BotMode = "paper" | "live";
export type ExecutionStyle = "sell_yes" | "buy_no_proxy";
export type SignalKind = "near_zero_yes" | "neg_risk_sell_basket";

export interface BotConfig {
  gammaApiBase: string;
  clobApiBase: string;
  botMode: BotMode;
  liveTrading: boolean;
  confirmLiveTrading: string;
  pollIntervalMs: number;
  maxMarkets: number;
  minLiquidity: number;
  minVolume24h: number;
  sportsOnly: boolean;
  nearZeroYesMaxBid: number;
  minBookSize: number;
  maxSpread: number;
  correlationEdgeMin: number;
  staleBookMs: number;
  orderNotionalUsd: number;
  maxOrderNotionalUsd: number;
  maxSettlementRiskUsd: number;
  maxDailyNotionalUsd: number;
  maxOpenOrders: number;
  sellYesRequiresInventory: boolean;
  executionStyle: ExecutionStyle;
  executeBaskets: boolean;
  privateKey?: `0x${string}`;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  rpcUrl?: string;
  category?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  output: "text" | "json";
}

export interface GammaEvent {
  id?: string | number;
  slug?: string;
  title?: string;
  active?: boolean;
  closed?: boolean;
  liquidity?: string | number;
  volume24hr?: string | number;
  enableOrderBook?: boolean;
  negRisk?: boolean;
  tags?: Array<{ label?: string; slug?: string }>;
  markets?: GammaMarket[];
}

export interface GammaMarket {
  id?: string | number;
  question?: string;
  conditionId?: string;
  slug?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  outcomes?: string[] | string;
  outcomePrices?: string[] | number[] | string;
  clobTokenIds?: string[] | string;
  liquidity?: string | number;
  liquidityNum?: string | number;
  liquidityClob?: string | number;
  volume24hr?: string | number;
  volume24hrClob?: string | number;
  volumeNum?: string | number;
  bestBid?: string | number;
  bestAsk?: string | number;
  spread?: string | number;
  lastTradePrice?: string | number;
  orderPriceMinTickSize?: string | number;
  orderMinSize?: string | number;
  negRisk?: boolean;
  negRiskMarketID?: string;
  groupItemTitle?: string;
  endDate?: string;
  endDateIso?: string;
  startDate?: string;
  feeType?: string | null;
  feesEnabled?: boolean;
}

export interface OutcomeToken {
  outcome: string;
  tokenId: string;
  price?: number;
}

export interface MarketSnapshot {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventTags: string[];
  marketId: string;
  conditionId: string;
  question: string;
  slug: string;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  liquidity: number;
  volume24h: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  lastTradePrice?: number;
  minOrderSize: number;
  tickSize: TickSize;
  negRisk: boolean;
  negRiskMarketId?: string;
  groupItemTitle?: string;
  endDate?: string;
  outcomes: OutcomeToken[];
  yesToken?: OutcomeToken;
  noToken?: OutcomeToken;
}

export interface BookLevel {
  price: number;
  size: number;
}

export interface BookSnapshot {
  tokenId: string;
  market: string;
  timestampMs: number;
  bids: BookLevel[];
  asks: BookLevel[];
  bestBid?: BookLevel;
  bestAsk?: BookLevel;
  spread?: number;
  minOrderSize: number;
  tickSize: TickSize;
  negRisk: boolean;
  raw: OrderBookSummary;
}

export interface EnrichedMarket extends MarketSnapshot {
  yesBook?: BookSnapshot;
  noBook?: BookSnapshot;
}

export interface SignalLeg {
  market: EnrichedMarket;
  tokenId: string;
  outcome: "YES" | "NO";
  side: Side;
  price: number;
  availableSize: number;
}

export interface TradingSignal {
  id: string;
  kind: SignalKind;
  title: string;
  edge: number;
  score: number;
  reason: string;
  createdAt: string;
  legs: SignalLeg[];
}

export interface TradeIntent {
  signalId: string;
  signalKind: SignalKind;
  description: string;
  tokenId: string;
  side: Side;
  price: number;
  size: number;
  notionalUsd: number;
  maxSettlementRiskUsd: number;
  tickSize: TickSize;
  negRisk: boolean;
  marketQuestion: string;
  marketSlug: string;
  dryRun: boolean;
}

export interface ExecutionResult {
  intent: TradeIntent;
  status: "paper" | "submitted" | "skipped" | "failed";
  message: string;
  response?: unknown;
}
