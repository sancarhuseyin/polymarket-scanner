import "dotenv/config";
import { z } from "zod";
import type { BotConfig, BotMode, ExecutionStyle } from "./types.js";

const LIVE_CONFIRMATION = "I_ACCEPT_THE_RISK";

const envSchema = z.object({
  GAMMA_API_BASE: z.string().url().default("https://gamma-api.polymarket.com"),
  CLOB_API_BASE: z.string().url().default("https://clob.polymarket.com"),
  BOT_MODE: z.enum(["paper", "live"]).default("paper"),
  LIVE_TRADING: z.string().default("false"),
  CONFIRM_LIVE_TRADING: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  MAX_MARKETS: z.coerce.number().int().positive().default(200),
  MIN_LIQUIDITY: z.coerce.number().nonnegative().default(500),
  MIN_VOLUME_24H: z.coerce.number().nonnegative().default(0),
  SPORTS_ONLY: z.string().default("false"),
  NEAR_ZERO_YES_MAX_BID: z.coerce.number().positive().max(0.25).default(0.02),
  MIN_BOOK_SIZE: z.coerce.number().positive().default(5),
  MAX_SPREAD: z.coerce.number().positive().max(1).default(0.03),
  CORRELATION_EDGE_MIN: z.coerce.number().positive().max(1).default(0.04),
  STALE_BOOK_MS: z.coerce.number().int().positive().default(15_000),
  ORDER_NOTIONAL_USD: z.coerce.number().positive().default(2),
  MAX_ORDER_NOTIONAL_USD: z.coerce.number().positive().default(5),
  MAX_SETTLEMENT_RISK_USD: z.coerce.number().positive().default(5),
  MAX_DAILY_NOTIONAL_USD: z.coerce.number().positive().default(25),
  MAX_OPEN_ORDERS: z.coerce.number().int().nonnegative().default(10),
  SELL_YES_REQUIRES_INVENTORY: z.string().default("true"),
  EXECUTION_STYLE: z.enum(["sell_yes", "buy_no_proxy"]).default("sell_yes"),
  EXECUTE_BASKETS: z.string().default("false"),
  PRIVATE_KEY: z.string().optional(),
  POLYMARKET_API_KEY: z.string().optional(),
  POLYMARKET_API_SECRET: z.string().optional(),
  POLYMARKET_API_PASSPHRASE: z.string().optional(),
  CLOB_API_KEY: z.string().optional(),
  CLOB_SECRET: z.string().optional(),
  CLOB_PASS_PHRASE: z.string().optional(),
  RPC_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  OUTPUT: z.enum(["text", "json"]).default("text")
});

function bool(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1" || value?.toLowerCase() === "yes";
}

function parsePrivateKey(value: string | undefined): `0x${string}` | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("PRIVATE_KEY must be a 32-byte hex string");
  }
  return normalized as `0x${string}`;
}

export function loadConfig(): BotConfig {
  const env = envSchema.parse(process.env);
  const botMode = env.BOT_MODE as BotMode;
  const liveTrading = bool(env.LIVE_TRADING) || botMode === "live";
  const apiKey = env.POLYMARKET_API_KEY ?? env.CLOB_API_KEY;
  const apiSecret = env.POLYMARKET_API_SECRET ?? env.CLOB_SECRET;
  const apiPassphrase = env.POLYMARKET_API_PASSPHRASE ?? env.CLOB_PASS_PHRASE;

  if (liveTrading && env.CONFIRM_LIVE_TRADING !== LIVE_CONFIRMATION) {
    throw new Error(`Live trading requires CONFIRM_LIVE_TRADING=${LIVE_CONFIRMATION}`);
  }

  if (liveTrading && (!env.PRIVATE_KEY || !apiKey || !apiSecret || !apiPassphrase)) {
    throw new Error("Live trading requires PRIVATE_KEY and Polymarket CLOB API credentials");
  }

  return {
    gammaApiBase: env.GAMMA_API_BASE,
    clobApiBase: env.CLOB_API_BASE,
    botMode,
    liveTrading,
    confirmLiveTrading: env.CONFIRM_LIVE_TRADING ?? "",
    pollIntervalMs: env.POLL_INTERVAL_MS,
    maxMarkets: env.MAX_MARKETS,
    minLiquidity: env.MIN_LIQUIDITY,
    minVolume24h: env.MIN_VOLUME_24H,
    sportsOnly: bool(env.SPORTS_ONLY),
    nearZeroYesMaxBid: env.NEAR_ZERO_YES_MAX_BID,
    minBookSize: env.MIN_BOOK_SIZE,
    maxSpread: env.MAX_SPREAD,
    correlationEdgeMin: env.CORRELATION_EDGE_MIN,
    staleBookMs: env.STALE_BOOK_MS,
    orderNotionalUsd: Math.min(env.ORDER_NOTIONAL_USD, env.MAX_ORDER_NOTIONAL_USD),
    maxOrderNotionalUsd: env.MAX_ORDER_NOTIONAL_USD,
    maxSettlementRiskUsd: env.MAX_SETTLEMENT_RISK_USD,
    maxDailyNotionalUsd: env.MAX_DAILY_NOTIONAL_USD,
    maxOpenOrders: env.MAX_OPEN_ORDERS,
    sellYesRequiresInventory: bool(env.SELL_YES_REQUIRES_INVENTORY),
    executionStyle: env.EXECUTION_STYLE as ExecutionStyle,
    executeBaskets: bool(env.EXECUTE_BASKETS),
    privateKey: parsePrivateKey(env.PRIVATE_KEY),
    apiKey,
    apiSecret,
    apiPassphrase,
    rpcUrl: env.RPC_URL,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramChatId: env.TELEGRAM_CHAT_ID,
    output: env.OUTPUT
  };
}
