# TokenWise VS Code Extension

TokenWise extension provides task-aware code pruning using a running SWE-Pruner backend.

## Features

- Prune selected code from editor context menu
- Prune current file from command palette or context menu
- Check backend health
- Side-by-side result panel with:
  - score
  - token counts
  - reduction percent
  - original vs pruned code
- Copy pruned code
- Insert pruned code at cursor

## Commands

- TokenWise: Prune Selected Code
- TokenWise: Prune Current File
- TokenWise: Check Backend Health

## Extension Settings

- tokenWise.apiUrl (default: http://127.0.0.1:8000)
- tokenWise.timeoutMs (default: 120000)
- tokenWise.defaultThreshold (default: 0.45)
- tokenWise.autoOpenResultPanel (default: true)

## Local Development

From repo root:

    cd vscode-extension
    npm install
    npm run compile

Open the folder in VS Code and press F5 to run the Extension Development Host.

## Backend Requirement

SWE-Pruner backend must be running and healthy.

Health check URL:

    http://127.0.0.1:8000/health

## Typical Flow

1. Select code
2. Run TokenWise: Prune Selected Code
3. Enter task query and threshold
4. Use result panel to copy or insert pruned output
