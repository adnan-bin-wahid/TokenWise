import * as vscode from "vscode";
import { TokenWiseApiClient } from "../services/apiClient";
import { getTokenWiseConfig } from "../services/config";
import { ResultPanel } from "../ui/resultPanel";

export function createBuildRepositoryContextCommand(
  panel: ResultPanel,
  extensionUri: vscode.Uri,
) {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("TokenWise: no active editor.");
      return;
    }

    const document = editor.document;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      void vscode.window.showWarningMessage("TokenWise: open a workspace folder first.");
      return;
    }

    // Prompt user for their raw query intent
    const query = await vscode.window.showInputBox({
      prompt: "Enter your repository search or fix query (e.g. 'fix auth bug', 'optimize db loop')",
      placeHolder: "Query...",
    });
    if (query === undefined) {
      return; // Canceled
    }

    const cfg = getTokenWiseConfig();
    const threshold = cfg.defaultThreshold;

    // Collect editor evidence
    const activeFile = document.uri.fsPath;
    const language = document.languageId;
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Selected text or active symbol under cursor
    const selection = editor.selection;
    const selectedCode = document.getText(selection) || undefined;
    
    // Resolve word under cursor as current_symbol if no active selection
    let currentSymbol: string | undefined;
    if (selectedCode) {
      currentSymbol = selectedCode.trim().split(/\s+/)[0];
    } else {
      const position = editor.selection.active;
      const wordRange = document.getWordRangeAtPosition(position);
      if (wordRange) {
        currentSymbol = document.getText(wordRange);
      }
    }

    // Get VS Code Diagnostics (errors and warnings)
    const diagnostics = vscode.languages.getDiagnostics(document.uri)
      .filter(d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning)
      .map(d => d.message);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "TokenWise: synthesizing goal and pruning repository...",
        cancellable: false,
      },
      async () => {
        try {
          const client = new TokenWiseApiClient(cfg);
          const response = await client.pruneWorkspace({
            query,
            workspace_root: workspaceRoot,
            active_file: activeFile,
            language,
            current_symbol: currentSymbol,
            selected_code: selectedCode,
            diagnostics,
            threshold,
          });

          // Show in webview panel
          panel.showWorkspaceResult(response, extensionUri);
          void vscode.window.showInformationMessage("TokenWise: Repository context built successfully.");
        } catch (error) {
          void vscode.window.showErrorMessage(`TokenWise workspace prune failed: ${String(error)}`);
        }
      },
    );
  };
}
