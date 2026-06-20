import { loadConfig } from "./config.js";
import { printJson, printReport } from "./report.js";
import { runScan } from "./scanner.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "scan";
  const config = loadConfig();

  if (command !== "scan" && command !== "bot") {
    throw new Error("Usage: npm run scan | npm run bot");
  }

  if (command === "scan") {
    const report = await runScan(config, false);
    config.output === "json" ? printJson(report) : printReport(report);
    return;
  }

  await runBot(config);
}

async function runBot(config: ReturnType<typeof loadConfig>): Promise<void> {
  let stopped = false;
  process.once("SIGINT", () => {
    stopped = true;
  });

  while (!stopped) {
    const report = await runScan(config, true);
    config.output === "json" ? printJson(report) : printReport(report);

    if (process.env.RUN_ONCE === "true") {
      break;
    }

    await sleep(config.pollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
