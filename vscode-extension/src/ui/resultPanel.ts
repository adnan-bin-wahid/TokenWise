import * as vscode from "vscode";
import { PruneResultViewModel, WorkspacePruneResponse } from "../types";

export class ResultPanel {
  private static viewType = "tokenwise.resultPanel";
  private panel: vscode.WebviewPanel | undefined;
  private latestResult: PruneResultViewModel | undefined;
  private latestWorkspaceResult: WorkspacePruneResponse | undefined;

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

  public showWorkspaceResult(result: WorkspacePruneResponse, extensionUri: vscode.Uri): void {
    this.latestWorkspaceResult = result;

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
        if (msg.command === "copyWorkspace") {
          if (this.latestWorkspaceResult) {
            await vscode.env.clipboard.writeText(this.latestWorkspaceResult.unified_prompt);
            void vscode.window.showInformationMessage("TokenWise: unified workspace context copied.");
          }
          return;
        }

        if (msg.command === "insertWorkspace") {
          const editor = vscode.window.activeTextEditor;
          if (!editor && this.latestWorkspaceResult) {
            void vscode.window.showWarningMessage("TokenWise: no active editor to insert into.");
            return;
          }
          await editor?.edit((builder) => {
            builder.insert(editor.selection.active, this.latestWorkspaceResult!.unified_prompt);
          });
          void vscode.window.showInformationMessage("TokenWise: inserted unified context at cursor.");
        }
      });
    }

    this.panel.title = "TokenWise Repository Result";
    this.panel.webview.html = this.getWorkspaceHtml(result);
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
      --background: var(--vscode-editor-background, #1e1e1e);
      --foreground: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: color-mix(in srgb, var(--vscode-editor-foreground) 4%, var(--vscode-editor-background));
      --card-border: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
      --muted: var(--vscode-descriptionForeground, color-mix(in srgb, var(--vscode-editor-foreground) 60%, transparent));
      --ok: var(--vscode-testing-iconPassedColor, #4caf50);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
    }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: var(--font-family);
      margin: 20px;
      line-height: 1.5;
      font-size: 13px;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 4px;
      color: var(--foreground);
    }
    h3 {
      font-size: 11px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 6px;
    }
    .query-container {
      font-size: 13px;
      margin-bottom: 20px;
      color: var(--muted);
    }
    .query-value {
      color: var(--foreground);
      font-weight: 500;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .label {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .value {
      font-weight: 600;
      font-size: 16px;
    }
    .value.ok {
      color: var(--ok);
    }
    .meta-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      font-size: 12px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed var(--card-border);
      padding-bottom: 4px;
    }
    .meta-label {
      color: var(--muted);
    }
    .meta-value {
      font-weight: 500;
      color: var(--foreground);
    }
    pre {
      background-color: color-mix(in srgb, var(--vscode-editor-background) 80%, black);
      border: 1px solid var(--card-border);
      border-radius: 4px;
      padding: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: auto;
      max-height: 40vh;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 12px);
      margin: 0;
      color: var(--foreground);
    }
    .row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      padding: 8px 14px;
      border-radius: 4px;
      font-family: var(--font-family);
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.15s ease;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent));
      color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
      border: 1px solid var(--card-border);
    }
    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, color-mix(in srgb, var(--vscode-editor-foreground) 15%, transparent));
    }
  </style>
</head>
<body>
  <h2>TokenWise Result</h2>
  <div class="query-container">Query: <span class="query-value">${escapedQuery}</span></div>
  <div class="row">
    <button onclick="send('copy')">Copy Pruned Code</button>
    <button class="secondary" onclick="send('insert')">Insert At Cursor</button>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Score</div><div class="value">${result.score.toFixed(4)}</div></div>
    <div class="stat"><div class="label">Original Tokens</div><div class="value">${result.originTokenCount}</div></div>
    <div class="stat"><div class="label">Pruned Tokens</div><div class="value">${result.prunedTokenCount}</div></div>
    <div class="stat"><div class="label">Reduction</div><div class="value ok">${result.reductionPercent.toFixed(2)}%</div></div>
  </div>

  <div class="card" style="margin-top: 12px;">
    <h3>Skimming Details</h3>
    <div class="meta-info">
      <div class="meta-row"><span class="meta-label">Model Input Tokens</span><span class="meta-value">${result.modelInputTokenCount}</span></div>
      <div class="meta-row"><span class="meta-label">Kept Fragments</span><span class="meta-value">${result.keptFrags.join(", ") || "none"}</span></div>
    </div>
  </div>

  ${carbonSection}

  <div class="grid" style="margin-top: 12px;">
    <div class="card">
      <h3>Original Code</h3>
      <pre>${escapedOriginal}</pre>
    </div>
    <div class="card">
      <h3>Pruned Code</h3>
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

    <div class="meta-info" style="margin-top: 16px;">
      <div class="meta-row"><span class="meta-label">Model Family</span><span class="meta-value">${escapeHtml(result.carbonAfter.modelFamily)}</span></div>
      <div class="meta-row"><span class="meta-label">Prefill Route</span><span class="meta-value">${escapeHtml(result.carbonAfter.prefillRoute)}</span></div>
      <div class="meta-row"><span class="meta-label">Decode Route</span><span class="meta-value">${escapeHtml(result.carbonAfter.decodeRoute)}</span></div>
      <div class="meta-row"><span class="meta-label">Feature Source</span><span class="meta-value">${escapeHtml(result.carbonAfter.featuresSource)}</span></div>
      <div class="meta-row"><span class="meta-label">Carbon Intensity</span><span class="meta-value">${result.carbonAfter.carbonIntensityGPerKwh.toFixed(2)} gCO2/kWh</span></div>
    </div>
  </div>`;
  }

  private getWorkspaceHtml(result: WorkspacePruneResponse): string {
    const escapedGoal = escapeHtml(result.structured_goal.objective || "");
    const escapedType = escapeHtml(result.structured_goal.task_type || "");
    const escapedIdents = escapeHtml((result.structured_goal.identifiers || []).join(", ") || "none");
    const escapedErrors = escapeHtml((result.structured_goal.observed_errors || []).join(", ") || "none");
    const escapedPrompt = escapeHtml(result.unified_prompt);

    const rows = result.files.map(f => `
      <tr style="border-bottom: 1px dashed var(--card-border);">
        <td style="padding: 8px 0; color: var(--foreground);">${escapeHtml(f.file_path)}</td>
        <td style="padding: 8px 0; color: var(--muted);">${escapeHtml(f.relation)}</td>
        <td style="padding: 8px 0; text-align: center; color: var(--foreground);">${f.tier}</td>
        <td style="padding: 8px 0; text-align: right; color: var(--muted);">${f.original_tokens}</td>
        <td style="padding: 8px 0; text-align: right; color: var(--foreground); font-weight: 500;">${f.pruned_tokens}</td>
        <td style="padding: 8px 0; text-align: right; color: var(--foreground);">${f.score.toFixed(4)}</td>
      </tr>
    `).join("");

    const reductionPercent = result.original_tokens > 0 
      ? ((result.original_tokens - result.pruned_tokens) / result.original_tokens) * 100 
      : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TokenWise Repository Context</title>
  <style>
    :root {
      --background: var(--vscode-editor-background, #1e1e1e);
      --foreground: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: color-mix(in srgb, var(--vscode-editor-foreground) 4%, var(--vscode-editor-background));
      --card-border: color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent);
      --muted: var(--vscode-descriptionForeground, color-mix(in srgb, var(--vscode-editor-foreground) 60%, transparent));
      --ok: var(--vscode-testing-iconPassedColor, #4caf50);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
    }
    body {
      background-color: var(--background);
      color: var(--foreground);
      font-family: var(--font-family);
      margin: 20px;
      line-height: 1.5;
      font-size: 13px;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 4px;
      color: var(--foreground);
    }
    h3 {
      font-size: 11px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 6px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .label {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .value {
      font-weight: 600;
      font-size: 16px;
    }
    .value.ok {
      color: var(--ok);
    }
    .meta-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      font-size: 12px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed var(--card-border);
      padding-bottom: 4px;
    }
    .meta-label {
      color: var(--muted);
    }
    .meta-value {
      font-weight: 500;
      color: var(--foreground);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 12px;
    }
    th {
      text-align: left;
      color: var(--muted);
      padding-bottom: 8px;
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
    }
    pre {
      background-color: color-mix(in srgb, var(--vscode-editor-background) 80%, black);
      border: 1px solid var(--card-border);
      border-radius: 4px;
      padding: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: auto;
      max-height: 45vh;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 12px);
      margin: 0;
      color: var(--foreground);
    }
    .row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      padding: 8px 14px;
      border-radius: 4px;
      font-family: var(--font-family);
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.15s ease;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent));
      color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
      border: 1px solid var(--card-border);
    }
    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground, color-mix(in srgb, var(--vscode-editor-foreground) 15%, transparent));
    }
  </style>
</head>
<body>
  <h2>TokenWise Repository Context Result</h2>
  <div class="row" style="margin-top: 12px;">
    <button onclick="send('copyWorkspace')">Copy Unified Context</button>
    <button class="secondary" onclick="send('insertWorkspace')">Insert At Cursor</button>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Original Workspace Tokens</div><div class="value">${result.original_tokens}</div></div>
    <div class="stat"><div class="label">Pruned Workspace Tokens</div><div class="value">${result.pruned_tokens}</div></div>
    <div class="stat"><div class="label">Total Reduction</div><div class="value ok">${reductionPercent.toFixed(2)}%</div></div>
  </div>

  <div class="card">
    <h3>Synthesized Goal Detail</h3>
    <div class="meta-info">
      <div class="meta-row"><span class="meta-label">Task Type</span><span class="meta-value">${escapedType}</span></div>
      <div class="meta-row"><span class="meta-label">Target Identifiers</span><span class="meta-value">${escapedIdents}</span></div>
      <div class="meta-row" style="grid-column: span 2;"><span class="meta-label">Synthesized Objective</span><span class="meta-value" style="text-align: right; width: 70%;">${escapedGoal}</span></div>
      <div class="meta-row" style="grid-column: span 2; border-bottom: none;"><span class="meta-label">Observed Errors</span><span class="meta-value" style="text-align: right; width: 70%;">${escapedErrors}</span></div>
    </div>
  </div>

  <div class="card">
    <h3>Retrieved Files and Symbol Relations</h3>
    <table>
      <thead>
        <tr>
          <th>File Path</th>
          <th>Relation</th>
          <th style="text-align: center;">Tier</th>
          <th style="text-align: right;">Orig. Tokens</th>
          <th style="text-align: right;">Pruned Tokens</th>
          <th style="text-align: right;">Rerank Score</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h3>Unified Pruned Prompt Context</h3>
    <pre>${escapedPrompt}</pre>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
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
