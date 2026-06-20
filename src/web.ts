import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { serializeReport } from "./report.js";
import { runScan } from "./scanner.js";
import type { BotConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const port = Number(process.env.PORT ?? 5173);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname === "/api/health") {
      sendJson(response, {
        ok: true,
        mode: loadConfig().liveTrading ? "live-env" : "paper",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/api/scan") {
      await handleScan(url, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(
      response,
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});

server.listen(port, () => {
  console.log(`Polymarket UI running at http://localhost:${port}`);
});

async function handleScan(url: URL, response: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const config = applyQueryOverrides(loadConfig(), url.searchParams);
  const report = await runScan(config, false);
  const serialized = serializeReport(report);

  sendJson(response, {
    ok: true,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    mode: "paper-ui",
    config: publicConfig(config),
    report: serialized
  });
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDir, `.${cleanPath}`);

  if (!filePath.startsWith(publicDir)) {
    sendText(response, "Forbidden", 403);
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[ext] ?? "application/octet-stream"
    });
    response.end(data);
  } catch {
    sendText(response, "Not found", 404);
  }
}

function applyQueryOverrides(config: BotConfig, params: URLSearchParams): BotConfig {
  return {
    ...config,
    liveTrading: false,
    botMode: "paper",
    sportsOnly: getBool(params, "sportsOnly", config.sportsOnly),
    maxMarkets: clampInt(getNumber(params, "maxMarkets", config.maxMarkets), 20, 500),
    minLiquidity: clamp(getNumber(params, "minLiquidity", config.minLiquidity), 0, 10_000_000),
    minVolume24h: clamp(getNumber(params, "minVolume24h", config.minVolume24h), 0, 10_000_000),
    nearZeroYesMaxBid: clamp(getNumber(params, "nearZeroYesMaxBid", config.nearZeroYesMaxBid), 0.001, 0.25),
    maxSpread: clamp(getNumber(params, "maxSpread", config.maxSpread), 0.001, 0.5),
    correlationEdgeMin: clamp(getNumber(params, "correlationEdgeMin", config.correlationEdgeMin), 0.001, 0.5),
    minBookSize: clamp(getNumber(params, "minBookSize", config.minBookSize), 1, 10_000),
    category: params.get("category") || undefined,
    output: "json"
  };
}

function publicConfig(config: BotConfig): Record<string, unknown> {
  return {
    sportsOnly: config.sportsOnly,
    maxMarkets: config.maxMarkets,
    minLiquidity: config.minLiquidity,
    minVolume24h: config.minVolume24h,
    nearZeroYesMaxBid: config.nearZeroYesMaxBid,
    maxSpread: config.maxSpread,
    correlationEdgeMin: config.correlationEdgeMin,
    minBookSize: config.minBookSize,
    executionStyle: config.executionStyle,
    liveTradingAvailable: config.liveTrading
  };
}

function getNumber(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function getBool(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const value = params.get(key);
  if (value === null) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clamp(value, min, max));
}

function sendJson(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function sendText(response: ServerResponse, body: string, status = 200): void {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}
