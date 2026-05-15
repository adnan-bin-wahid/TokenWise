import * as vscode from "vscode";
import { PruneService } from "./services/pruneService";
import { ResultPanel } from "./ui/resultPanel";
import { createPruneSelectedCommand } from "./commands/pruneSelected";
import { createPruneCurrentFileCommand } from "./commands/pruneCurrentFile";
import { createCheckHealthCommand } from "./commands/checkHealth";

export function activate(context: vscode.ExtensionContext): void {
  const service = new PruneService();
  const panel = new ResultPanel();

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = "$(filter) TokenWise";
  statusItem.tooltip = "TokenWise is ready";
  statusItem.command = "tokenwise.checkHealth";
  statusItem.show();

  context.subscriptions.push(
    statusItem,
    vscode.commands.registerCommand(
      "tokenwise.pruneSelected",
      createPruneSelectedCommand(service, panel, context.extensionUri)
    ),
    vscode.commands.registerCommand(
      "tokenwise.pruneCurrentFile",
      createPruneCurrentFileCommand(service, panel, context.extensionUri)
    ),
    vscode.commands.registerCommand("tokenwise.checkHealth", createCheckHealthCommand(service))
  );
}

export function deactivate(): void {
  // no-op
}
