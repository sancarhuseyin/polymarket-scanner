import {
  AssetType,
  Chain,
  ClobClient,
  CONDITIONAL_TOKEN_DECIMALS,
  OrderType,
  Side,
  type ApiKeyCreds
} from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { BotConfig, ExecutionResult, TradeIntent } from "./types.js";

export interface Executor {
  execute(intent: TradeIntent): Promise<ExecutionResult>;
}

export class PaperExecutor implements Executor {
  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    return {
      intent,
      status: "paper",
      message: `${intent.side} ${intent.size} @ ${intent.price} on ${intent.marketSlug}`
    };
  }
}

export class LiveExecutor implements Executor {
  private readonly client: ClobClient;
  private submittedNotionalUsd = 0;

  constructor(private readonly config: BotConfig) {
    if (!config.privateKey || !config.apiKey || !config.apiSecret || !config.apiPassphrase) {
      throw new Error("LiveExecutor requires private key and CLOB API credentials");
    }

    const account = privateKeyToAccount(config.privateKey);
    const walletClient = createWalletClient({
      account,
      transport: http(config.rpcUrl)
    });
    const creds: ApiKeyCreds = {
      key: config.apiKey,
      secret: config.apiSecret,
      passphrase: config.apiPassphrase
    };

    this.client = new ClobClient({
      host: config.clobApiBase,
      chain: Chain.POLYGON,
      signer: walletClient,
      creds,
      throwOnError: true,
      retryOnError: true
    });
  }

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    if (!this.config.liveTrading) {
      return new PaperExecutor().execute(intent);
    }

    const guard = await this.checkGuards(intent);
    if (guard) {
      return {
        intent,
        status: "skipped",
        message: guard
      };
    }

    try {
      const response = await this.client.createAndPostOrder(
        {
          tokenID: intent.tokenId,
          price: intent.price,
          side: intent.side,
          size: intent.size
        },
        {
          tickSize: intent.tickSize,
          negRisk: intent.negRisk
        },
        OrderType.GTC,
        false
      );

      this.submittedNotionalUsd += intent.notionalUsd;
      return {
        intent,
        status: "submitted",
        message: `submitted ${intent.side} ${intent.size} @ ${intent.price}`,
        response
      };
    } catch (error) {
      return {
        intent,
        status: "failed",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkGuards(intent: TradeIntent): Promise<string | undefined> {
    if (intent.notionalUsd > this.config.maxOrderNotionalUsd) {
      return `order notional ${intent.notionalUsd.toFixed(2)} exceeds MAX_ORDER_NOTIONAL_USD`;
    }

    if (this.submittedNotionalUsd + intent.notionalUsd > this.config.maxDailyNotionalUsd) {
      return "MAX_DAILY_NOTIONAL_USD would be exceeded";
    }

    const openOrders = await this.client.getOpenOrders(undefined, true).catch(() => []);
    if (openOrders.length >= this.config.maxOpenOrders) {
      return `open order count ${openOrders.length} is at MAX_OPEN_ORDERS`;
    }

    if (intent.side === Side.SELL && this.config.sellYesRequiresInventory) {
      const balance = await this.getConditionalBalance(intent.tokenId);
      if (balance < intent.size) {
        return `conditional token balance ${balance.toFixed(4)} is below sell size ${intent.size}`;
      }
    }

    return undefined;
  }

  private async getConditionalBalance(tokenId: string): Promise<number> {
    const response = await this.client.getBalanceAllowance({
      asset_type: AssetType.CONDITIONAL,
      token_id: tokenId
    });
    const raw = Number(response.balance);
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return raw / 10 ** CONDITIONAL_TOKEN_DECIMALS;
  }
}

export function createExecutor(config: BotConfig): Executor {
  return config.liveTrading ? new LiveExecutor(config) : new PaperExecutor();
}
