import * as vscode from "vscode";

export interface TokenWiseConfig {
  apiUrl: string;
  timeoutMs: number;
  defaultThreshold: number;
  autoOpenResultPanel: boolean;
  enableCarbonEstimation: boolean;
  carbonEstimatorMode: "local" | "remote";
  targetModelName: string;
  targetModelSizeB: number;
  targetGpuType: string;
  targetMmluProScore?: number;
  targetBbhScore?: number;
  expectedOutputTokens: number;
  latencyPerInputTokenMs: number;
  latencyPerOutputTokenMs: number;
  carbonIntensityGPerKwh: number;
}

export function getTokenWiseConfig(): TokenWiseConfig {
  const cfg = vscode.workspace.getConfiguration("tokenWise");
  return {
    apiUrl: String(cfg.get("apiUrl", "http://127.0.0.1:8000")).replace(
      /\/$/,
      "",
    ),
    timeoutMs: Number(cfg.get("timeoutMs", 120000)),
    defaultThreshold: Number(cfg.get("defaultThreshold", 0.45)),
    autoOpenResultPanel: Boolean(cfg.get("autoOpenResultPanel", true)),
    enableCarbonEstimation: Boolean(cfg.get("enableCarbonEstimation", true)),
    carbonEstimatorMode: String(cfg.get("carbonEstimatorMode", "remote")) === "remote" ? "remote" : "local",
    targetModelName: String(cfg.get("targetModelName", "gpt-4o")),
    targetModelSizeB: Number(cfg.get("targetModelSizeB", 200)),
    targetGpuType: String(cfg.get("targetGpuType", "nvidia-a100-80gb")),
    targetMmluProScore: cfg.get<number>("targetMmluProScore"),
    targetBbhScore: cfg.get<number>("targetBbhScore"),
    expectedOutputTokens: Number(cfg.get("expectedOutputTokens", 256)),
    latencyPerInputTokenMs: Number(cfg.get("latencyPerInputTokenMs", 0.8)),
    latencyPerOutputTokenMs: Number(cfg.get("latencyPerOutputTokenMs", 2.2)),
    carbonIntensityGPerKwh: Number(cfg.get("carbonIntensityGPerKwh", 475)),
  };
}
