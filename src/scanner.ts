import type { BotConfig } from "./types.js";
import { ClobBookClient } from "./books.js";
import { createExecutor } from "./executor.js";
import { GammaClient } from "./gamma.js";
import { buildTradeIntents } from "./intents.js";
import { countMarketsWithBooks, type ScanReport } from "./report.js";
import { findSignals } from "./strategies.js";
import { sendTelegramAlerts } from "./telegram.js";

export async function runScan(config: BotConfig, execute: boolean): Promise<ScanReport> {
  const gamma = new GammaClient(config);
  const clob = new ClobBookClient(config);

  const markets = await gamma.fetchActiveMarkets();
  const enriched = await clob.enrichMarkets(markets);
  const signals = findSignals(enriched, config);
  
  // Trigger Telegram Alerts asynchronously
  sendTelegramAlerts(signals, config).catch((err) => {
    console.error("Telegram notify error:", err);
  });

  const intents = buildTradeIntents(signals, config);
  const executor = execute ? createExecutor(config) : undefined;
  const executions = executor
    ? await Promise.all(intents.map((intent) => executor.execute(intent)))
    : undefined;

  return {
    scannedMarkets: markets.length,
    bookMarkets: countMarketsWithBooks(enriched),
    signals,
    intents,
    executions
  };
}
