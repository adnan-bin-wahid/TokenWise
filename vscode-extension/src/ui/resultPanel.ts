import * as vscode from "vscode";
import { PruneResultViewModel } from "../types";

export class ResultPanel {
  private static viewType = "tokenwise.resultPanel";
  private panel: vscode.WebviewPanel | undefined;
  private latestResult: PruneResultViewModel | undefined;

  public show(result: PruneResultViewModel, extensionUri: vscode.Uri): void {
    this.latestResult = result;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        ResultPanel.viewType,
        "TokenWise Result",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage(async (msg) => {
        if (!this.latestResult) {
          return;
        }

        if (msg.command === "copy") {
          await vscode.env.clipboard.writeText(this.latestResult.prunedCode);
          void vscode.window.showInformationMessage(
            "TokenWise: pruned code copied.",
          );
          return;
        }

        if (msg.command === "insert") {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            void vscode.window.showWarningMessage(
              "TokenWise: no active editor to insert into.",
            );
            return;
          }

          await editor.edit((builder) => {
            builder.insert(
              editor.selection.active,
              this.latestResult!.prunedCode,
            );
          });
          void vscode.window.showInformationMessage(
            "TokenWise: inserted pruned code at cursor.",
          );
        }
      });
    }

    this.panel.title = "TokenWise Result";
    this.panel.webview.html = this.getHtml(result);
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  private getHtml(result: PruneResultViewModel): string {
    const escapedQuery = escapeHtml(result.query);
    const escapedOriginal = escapeHtml(result.originalCode);
    const escapedPruned = escapeHtml(result.prunedCode);
    const carbonSection = this.renderCarbonSection(result);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TokenWise Result</title>
  <style>
    :root {
      color-scheme: light dark;
      --ok: #2e7d32;
      --card: color-mix(in srgb, canvas 92%, #888 8%);
      --muted: color-mix(in srgb, canvastext 50%, transparent);
    }
    body { font-family: var(--vscode-font-family, sans-serif); margin: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { background: var(--card); border-radius: 8px; padding: 12px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .stat { background: var(--card); border-radius: 8px; padding: 8px; }
    .label { color: var(--muted); font-size: 12px; }
    .value { font-weight: 700; font-size: 14px; }
    pre { white-space: pre-wrap; word-wrap: break-word; overflow: auto; max-height: 55vh; }
    .row { display: flex; gap: 8px; margin: 12px 0; }
    button { cursor: pointer; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--muted); }
    h2, h3 { margin: 8px 0; }
    .ok { color: var(--ok); }
  </style>
</head>
<body>
  <h2>TokenWise Result</h2>
  <div><strong>Query:</strong> ${escapedQuery}</div>
  <div class="row">
    <button onclick="send('copy')">Copy Pruned Code</button>
    <button onclick="send('insert')">Insert At Cursor</button>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Score</div><div class="value">${result.score.toFixed(4)}</div></div>
    <div class="stat"><div class="label">Original Tokens</div><div class="value">${result.originTokenCount}</div></div>
    <div class="stat"><div class="label">Pruned Tokens</div><div class="value">${result.prunedTokenCount}</div></div>
    <div class="stat"><div class="label">Reduction</div><div class="value ok">${result.reductionPercent.toFixed(2)}%</div></div>
  </div>

  <div class="card" style="margin-top: 12px;">
    <div><strong>Model Input Tokens:</strong> ${result.modelInputTokenCount}</div>
    <div><strong>Kept Fragments:</strong> ${result.keptFrags.join(", ") || "none"}</div>
  </div>

  ${carbonSection}

  <div class="grid" style="margin-top: 12px;">
    <div class="card">
      <h3>Original</h3>
      <pre>${escapedOriginal}</pre>
    </div>
    <div class="card">
      <h3>Pruned</h3>
      <pre>${escapedPruned}</pre>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
  }

  private renderCarbonSection(result: PruneResultViewModel): string {
    if (!result.carbonBefore || !result.carbonAfter || !result.carbonSavings) {
      return "";
    }

    return `
  <div class="card" style="margin-top: 12px;">
    <h3>Carbon Impact (SEAL-style estimate)</h3>
    <div class="stats">
      <div class="stat"><div class="label">Prefill Saved</div><div class="value ok">${result.carbonSavings.prefillJoulesSaved.toFixed(4)} J</div></div>
      <div class="stat"><div class="label">Decode Saved</div><div class="value ok">${result.carbonSavings.decodeJoulesSaved.toFixed(4)} J</div></div>
      <div class="stat"><div class="label">Total Saved</div><div class="value ok">${result.carbonSavings.totalJoulesSaved.toFixed(4)} J</div></div>
      <div class="stat"><div class="label">CO2 Avoided</div><div class="value ok">${result.carbonSavings.co2GramsSaved.toFixed(6)} g</div></div>
    </div>
    <div style="margin-top: 8px;"><strong>Model:</strong> ${escapeHtml(result.carbonAfter.modelFamily)}</div>
    <div><strong>Route:</strong> ${escapeHtml(result.carbonAfter.route)}</div>
    <div><strong>Carbon Intensity:</strong> ${result.carbonAfter.carbonIntensityGPerKwh.toFixed(2)} gCO2/kWh</div>
  </div>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
