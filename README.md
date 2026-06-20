# Polymarket Scanner Bot

TypeScript scanner/bot for low-implied-probability YES sells and mutually exclusive market gaps on Polymarket.

![Polymarket Edge Desk Dashboard Preview](screenshots/ui_preview.jpg)

The bot is paper-only by default. It reads public Gamma/CLOB data, generates signals, and builds trade intents. Live order submission requires explicit env gates and CLOB credentials.

## What It Does

- Scans active Polymarket events from Gamma.
- Pulls live CLOB order books for YES/NO tokens.
- Flags `near_zero_yes` signals when the YES best bid is below `NEAR_ZERO_YES_MAX_BID`.
- Flags `neg_risk_sell_basket` signals when mutually exclusive YES bids sum above `1 + CORRELATION_EDGE_MIN`.
- Builds risk-capped trade intents.
- Submits CLOB GTC limit orders only when live mode is explicitly enabled.

## Setup

```bash
npm install
cp .env.example .env
```

Run a read-only scan:

```bash
npm run scan
```

Run the loop in paper mode:

```bash
npm run bot
```

Run the local web UI:

```bash
npm run ui
```

Then open `http://localhost:5173`.

Run once in bot mode:

```bash
RUN_ONCE=true npm run bot
```

On PowerShell:

```powershell
$env:RUN_ONCE="true"; npm run bot
```

## Important Env Vars

- `SPORTS_ONLY=true` filters toward sports markets.
- `NEAR_ZERO_YES_MAX_BID=0.02` means YES bids at or below 2%.
- `CORRELATION_EDGE_MIN=0.04` requires basket bid sum above 1.04.
- `MAX_SETTLEMENT_RISK_USD=5` caps SELL YES settlement exposure per order.
- `EXECUTION_STYLE=sell_yes` places SELL orders on YES tokens.
- `EXECUTION_STYLE=buy_no_proxy` buys NO tokens instead, which is the cash-funded proxy for short YES exposure.
- `EXECUTE_BASKETS=false` keeps multi-leg basket arb signals from auto-submitting by default.

## Live Trading

Live trading requires all of this:

```env
BOT_MODE=live
LIVE_TRADING=true
CONFIRM_LIVE_TRADING=I_ACCEPT_THE_RISK
PRIVATE_KEY=0x...
POLYMARKET_API_KEY=...
POLYMARKET_API_SECRET=...
POLYMARKET_API_PASSPHRASE=...
```

By default, `SELL_YES_REQUIRES_INVENTORY=true`. That means live SELL YES orders are skipped unless the wallet already has enough YES conditional-token balance. To create short-YES exposure from cash, use `EXECUTION_STYLE=buy_no_proxy`.

Use this only where Polymarket trading is legal and permitted for your account. This code does not bypass regional, account, compliance, or market restrictions.

## Verification

```bash
npm run typecheck
npm run test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

