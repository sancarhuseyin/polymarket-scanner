import type { BotConfig, TradingSignal } from "./types.js";

const notifiedSignalIds = new Set<string>();

export async function sendTelegramAlerts(signals: TradingSignal[], config: BotConfig): Promise<void> {
  const { telegramBotToken, telegramChatId } = config;
  if (!telegramBotToken || !telegramChatId || !signals.length) {
    return;
  }

  // Filter to find new signals not yet notified
  const newSignals = signals.filter((signal) => {
    if (notifiedSignalIds.has(signal.id)) {
      return false;
    }
    notifiedSignalIds.add(signal.id);
    // Keep size bounded
    if (notifiedSignalIds.size > 2000) {
      const firstKey = notifiedSignalIds.keys().next().value;
      if (firstKey) {
        notifiedSignalIds.delete(firstKey);
      }
    }
    return true;
  });

  if (newSignals.length === 0) {
    return;
  }

  for (const signal of newSignals) {
    const edgePct = (signal.edge * 100).toFixed(1);
    const dateStr = new Date(signal.createdAt).toLocaleTimeString();
    const typeLabel = signal.kind === "neg_risk_sell_basket" ? "🧺 NEG-RISK BASKET" : "🎯 NEAR-ZERO YES";

    let message = `⚠️ *Polymarket Signal Alert* [${dateStr}]\n`;
    message += `Type: *${typeLabel}*\n`;
    message += `Title: *${signal.title}*\n`;
    message += `Edge: *${edgePct}%*\n\n`;
    message += `*Details:*\n${signal.reason}\n\n`;

    if (signal.legs && signal.legs.length > 0) {
      message += `*Legs:*\n`;
      for (const leg of signal.legs) {
        const legName = leg.market.groupItemTitle || leg.market.question || "YES";
        const price = leg.price.toFixed(leg.price < 0.01 ? 4 : 3);
        const depth = leg.availableSize.toLocaleString(undefined, { maximumFractionDigits: 0 });
        message += `- ${legName}: *${price}* (depth: ${depth})\n`;
      }
    }

    try {
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: "Markdown"
        })
      });

      if (!response.ok) {
        console.error(`Telegram API error: ${response.status} ${await response.text()}`);
      }
    } catch (err) {
      console.error("Failed to send Telegram notification:", err);
    }
  }
}
