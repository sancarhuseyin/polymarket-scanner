import type { BotConfig, GammaEvent, GammaMarket, MarketSnapshot, OutcomeToken } from "./types.js";

const SPORTS_TERMS = [
  "sports",
  "soccer",
  "football",
  "basketball",
  "baseball",
  "hockey",
  "tennis",
  "golf",
  "nba",
  "nfl",
  "mlb",
  "nhl",
  "fifa",
  "world cup",
  "ufc",
  "mma",
  "formula 1",
  "f1"
];

export class GammaClient {
  constructor(private readonly config: BotConfig) {}

  async fetchActiveMarkets(): Promise<MarketSnapshot[]> {
    const events = await this.fetchEvents();
    const markets = events.flatMap((event) => normalizeEventMarkets(event));
    const now = Date.now();
    return markets
      .filter((market) => market.active && !market.closed)
      .filter((market) => market.acceptingOrders && market.enableOrderBook)
      .filter((market) => market.yesToken && market.noToken)
      .filter((market) => market.liquidity >= this.config.minLiquidity)
      .filter((market) => market.volume24h >= this.config.minVolume24h)
      .filter((market) => !this.config.sportsOnly || isSportsMarket(market))
      .filter((market) => {
        if (market.endDate) {
          const time = Date.parse(market.endDate);
          return isNaN(time) || time > now;
        }
        return true;
      })
      .slice(0, this.config.maxMarkets);
  }

  private async fetchEvents(): Promise<GammaEvent[]> {
    const events: GammaEvent[] = [];
    const pageSize = Math.min(100, Math.max(1, this.config.maxMarkets));

    for (let offset = 0; events.length < this.config.maxMarkets; offset += pageSize) {
      const url = new URL("/events", this.config.gammaApiBase);
      url.searchParams.set("active", "true");
      url.searchParams.set("closed", "false");
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("order", "volume24hr");
      url.searchParams.set("ascending", "false");
      if (this.config.category && this.config.category !== "all") {
        url.searchParams.set("tag_slug", this.config.category);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Gamma events request failed: ${response.status} ${response.statusText}`);
      }

      const page = (await response.json()) as GammaEvent[];
      if (!Array.isArray(page) || page.length === 0) {
        break;
      }

      events.push(...page);
      if (page.length < pageSize) {
        break;
      }
    }

    return events;
  }
}

export function normalizeEventMarkets(event: GammaEvent): MarketSnapshot[] {
  const eventTags = (event.tags ?? [])
    .flatMap((tag) => [tag.label, tag.slug])
    .filter((tag): tag is string => Boolean(tag));

  return (event.markets ?? [])
    .map((market) => normalizeMarket(event, market, eventTags))
    .filter((market): market is MarketSnapshot => market !== undefined);
}

function normalizeMarket(
  event: GammaEvent,
  market: GammaMarket,
  eventTags: string[]
): MarketSnapshot | undefined {
  const outcomes = parseStringArray(market.outcomes);
  const tokenIds = parseStringArray(market.clobTokenIds);
  const prices = parseNumberArray(market.outcomePrices);

  if (!market.id || !market.conditionId || !market.question || outcomes.length !== tokenIds.length) {
    return undefined;
  }

  const outcomeTokens: OutcomeToken[] = outcomes.map((outcome, index) => ({
    outcome,
    tokenId: tokenIds[index] ?? "",
    price: prices[index]
  }));

  const yesToken = outcomeTokens.find((token) => token.outcome.toLowerCase() === "yes");
  const noToken = outcomeTokens.find((token) => token.outcome.toLowerCase() === "no");

  return {
    eventId: stringifyId(event.id),
    eventSlug: event.slug ?? "",
    eventTitle: event.title ?? "",
    eventTags,
    marketId: stringifyId(market.id),
    conditionId: market.conditionId,
    question: market.question,
    slug: market.slug ?? "",
    active: market.active === true && event.active !== false,
    closed: market.closed === true || event.closed === true,
    acceptingOrders: market.acceptingOrders !== false,
    enableOrderBook: market.enableOrderBook !== false && event.enableOrderBook !== false,
    liquidity: firstNumber(market.liquidityClob, market.liquidityNum, market.liquidity, event.liquidity),
    volume24h: firstNumber(market.volume24hrClob, market.volume24hr, event.volume24hr),
    bestBid: optionalNumber(market.bestBid),
    bestAsk: optionalNumber(market.bestAsk),
    spread: optionalNumber(market.spread),
    lastTradePrice: optionalNumber(market.lastTradePrice),
    minOrderSize: firstNumber(market.orderMinSize, 5),
    tickSize: toTickSize(market.orderPriceMinTickSize),
    negRisk: market.negRisk === true || event.negRisk === true,
    negRiskMarketId: market.negRiskMarketID,
    groupItemTitle: market.groupItemTitle,
    endDate: market.endDateIso ?? market.endDate,
    outcomes: outcomeTokens,
    yesToken,
    noToken
  };
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

export function parseNumberArray(value: unknown): Array<number | undefined> {
  return parseStringArray(value).map((part) => optionalNumber(part));
}

function stringifyId(value: string | number | undefined): string {
  return value === undefined ? "" : String(value);
}

function optionalNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = optionalNumber(value);
    if (number !== undefined) {
      return number;
    }
  }
  return 0;
}

function toTickSize(value: unknown): MarketSnapshot["tickSize"] {
  const tick = String(value ?? "0.01");
  if (tick === "0.1" || tick === "0.01" || tick === "0.001" || tick === "0.0001") {
    return tick;
  }
  return "0.01";
}

function isSportsMarket(market: MarketSnapshot): boolean {
  const haystack = [
    market.eventTitle,
    market.question,
    market.eventSlug,
    market.slug,
    market.groupItemTitle,
    ...market.eventTags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return SPORTS_TERMS.some((term) => haystack.includes(term));
}
