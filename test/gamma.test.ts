import { describe, expect, it } from "vitest";
import { normalizeEventMarkets, parseStringArray } from "../src/gamma.js";

describe("Gamma normalization", () => {
  it("parses Polymarket JSON array strings", () => {
    expect(parseStringArray("[\"Yes\", \"No\"]")).toEqual(["Yes", "No"]);
  });

  it("extracts yes/no tokens from event markets", () => {
    const [market] = normalizeEventMarkets({
      id: "event-1",
      slug: "winner",
      title: "Tournament winner",
      active: true,
      closed: false,
      enableOrderBook: true,
      markets: [
        {
          id: "market-1",
          conditionId: "0xabc",
          question: "Will Team A win?",
          slug: "team-a",
          active: true,
          closed: false,
          acceptingOrders: true,
          enableOrderBook: true,
          outcomes: "[\"Yes\", \"No\"]",
          outcomePrices: "[\"0.01\", \"0.99\"]",
          clobTokenIds: "[\"yes-token\", \"no-token\"]",
          liquidityNum: "1000",
          volume24hr: "25",
          orderPriceMinTickSize: 0.001,
          orderMinSize: 5,
          negRisk: true,
          negRiskMarketID: "group-1"
        }
      ]
    });

    expect(market?.yesToken?.tokenId).toBe("yes-token");
    expect(market?.noToken?.tokenId).toBe("no-token");
    expect(market?.tickSize).toBe("0.001");
    expect(market?.liquidity).toBe(1000);
  });
});
