import * as vscode from "vscode";

export interface TokenWiseConfig {
  apiUrl: string;
  timeoutMs: number;
  defaultThreshold: number;
  autoOpenResultPanel: boolean;
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
  };
}
