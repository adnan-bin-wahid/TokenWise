# TokenWise / SWE-Pruner v2 - Comprehensive Demonstration & Test Report

This document serves as a step-by-step manual testing guide and verification report for the **TokenWise v2** VS Code extension and the **SWE-Pruner** FastAPI backend service. 

Follow this guide to demonstrate all the features of the project in front of your supervisor. It covers every capability, option, and edge-case scenario.

---

## 1. Core Features Overview

1. **Active Health Monitoring**: Real-time checking of the backend service and verification that weights are loaded.
2. **Single-File Task-Aware Code Pruning**: Neural line-level importance ranking to discard boilerplate while keeping lines relevant to the developer's goal.
3. **Multi-File Workspace Context Pruning (v2)**: Repository-wide indexing, call-graph expansion, neural candidate reranking, and 3-tier prompt packaging.
4. **SEAL Carbon Estimator & Session Savings**: Tracking energy in Joules (J) and CO2 in grams (g) saved by pruning prompts. Shows cumulative savings in the VS Code status bar.
5. **Interactive Diff Webview**: Side-by-side comparison styled natively with VS Code theme variables, including "Copy to Clipboard" and "Insert at Cursor" triggers.
6. **Local LLM Configurations**: Custom settings to override the OpenAI-compatible endpoint URL and model identifier for local goal synthesis (e.g. Ollama/LM Studio).
7. **Connection Resilience & Fallbacks**: Graceful fallbacks when local LLMs or remote carbon estimators are offline.

---

## 2. Test Environment Setup

### 2.1 Launch the Backend Service
Start the FastAPI server inside your workspace directory. Depending on your terminal choice, use the appropriate command below:

**PowerShell**:
```powershell
$env:PYTHONPATH="swe-pruner/swe-pruner/src"; $env:SWEPRUNER_MODEL_PATH="swe-pruner/swe-pruner/model"; .venv\Scripts\python -m uvicorn swe_pruner.online_serving:app --host 127.0.0.1 --port 8000
```

**Git Bash / Linux Shell**:
```bash
PYTHONPATH="swe-pruner/swe-pruner/src" SWEPRUNER_MODEL_PATH="swe-pruner/swe-pruner/model" .venv/Scripts/python -m uvicorn swe_pruner.online_serving:app --host 127.0.0.1 --port 8000
```

**Windows Command Prompt (CMD)**:
```cmd
set PYTHONPATH=swe-pruner/swe-pruner/src
set SWEPRUNER_MODEL_PATH=swe-pruner/swe-pruner/model
.venv\Scripts\python -m uvicorn swe_pruner.online_serving:app --host 127.0.0.1 --port 8000
```
* **Expected Result**: 
  ```
  INFO:swe_pruner.online_serving:Model loaded successfully from swe-pruner/swe-pruner/model
  INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
  ```

### 2.2 Launch the Extension Host
1. Open a terminal, go to `e:\A A SPL3\part-2\swe-pruner\vscode-extension`.
2. Run `npm run compile` to build TypeScript code.
3. Launch the Extension Host window targeting the test project workspace:
   ```powershell
   code --extensionDevelopmentPath="e:\A A SPL3\part-2\swe-pruner\vscode-extension" "E:\A A SPL3\test-project2"
   ```
* **Expected Result**: A new VS Code instance opens. The bottom left status bar displays `$(filter) TokenWise` (a filter icon).

---

## 3. Step-by-Step Testing Scenarios

### Scenario 1: Backend Health Check
* **Objective**: Verify that the extension can connect to the server and detect the loaded neural model.
* **Steps**:
  1. In the Extension Host, open the Command Palette (`Ctrl+Shift+P` or `F1`).
  2. Search for and select: **`TokenWise: Check Backend Health`**.
* **Expected Result**: An info notification toast appears in the bottom right corner:
  `TokenWise backend healthy. Model: swe-pruner/swe-pruner/model loaded.`

---

### Scenario 2: User Settings & Local LLM Overrides
* **Objective**: Confirm that user-configured properties are registered and override default connections.
* **Steps**:
  1. Open VS Code Settings (`Ctrl+,`).
  2. Search for `TokenWise` to inspect the available settings:
     * `tokenWise.apiUrl`: Backend address.
     * `tokenWise.localLlmUrl`: Goal Generator LLM endpoint (default: `http://127.0.0.1:11434/v1`).
     * `tokenWise.localLlmModelName`: Goal Generator model (default: `qwen2.5-coder:1.5b-instruct-q4_k_m`).
     * `tokenWise.enableCarbonEstimation`: Toggle carbon footprint math.
     * `tokenWise.carbonEstimatorMode`: Choose `remote` (uses backend) or `local` (uses javascript logic).
  3. Modify `tokenWise.localLlmUrl` to `http://127.0.0.1:9999/v1` and save.
* **Expected Result**: The extension immediately reads the modified settings. When running a workspace prune, the backend tries to call `http://127.0.0.1:9999/v1` and log it. (Restore it to the default `http://127.0.0.1:11434/v1` after testing).

---

### Scenario 3: Selected Code Line Pruning & Carbon Status Bar
* **Objective**: Neural prune a selected block of code and verify that it updates the status bar with carbon savings.
* **Steps**:
  1. Open `main.py` inside the Extension Host editor.
  2. Highlight the `login` function definition (lines 20 to 30).
  3. Right-click the highlighted code and choose **`TokenWise: Prune Selected Code`**.
  4. Query: `Identify credentials validation and session generation`.
  5. Threshold: `0.45` (default).
* **Expected Result**:
  * A progress notification is displayed while pruning is in progress.
  * The TokenWise Result panel opens as a webview tab, styled natively with your active VS Code theme colors (adapts to light/dark).
  * Original and Pruned code panes are displayed side-by-side. Kept lines are visible; pruned lines display a placeholder like `(filtered X lines)`.
  * The **Carbon Footprint Estimation** section displays energy (Joules) and CO2 (grams) before and after, showing the savings.
  * Look at the bottom-left VS Code Status Bar. It should update to:
    `$(leaf) TokenWise 0.XXXXXXg saved` (with a green leaf icon showing cumulative saved session carbon).

---

### Scenario 4: Full File Code Pruning
* **Objective**: Prune the entire active editor without any text selection.
* **Steps**:
  1. Focused on `main.py`, clear your text selection.
  2. Press `Ctrl+Shift+P` and choose **`TokenWise: Prune Current File`**.
  3. Query: `Locate greeting functions`.
  4. Threshold: `0.40`.
* **Expected Result**:
  * The extension automatically extracts the entire file content.
  * The Result webview panel updates with the full file line-level pruning comparison.
  * The status bar cumulative carbon value increases.

---

### Scenario 5: Multi-File Workspace Context Pruning (v2 Integration)
* **Objective**: Synthesize a structured task-aware goal from diagnostics + active symbol, search imports/dependencies, and pack a multi-tier context.
* **Steps**:
  1. In `main.py`, write a syntax error or warning (e.g. call a non-existing method `auth.validate()`) so that a diagnostic squiggly error appears.
  2. Place your cursor on the word `serve` (active symbol).
  3. Right-click inside `main.py` and choose: **`TokenWise: Build Repository Context`**.
  4. Query: `fix backend startup port conflict`.
  5. Threshold: `0.45`.
* **Expected Result**:
  * The backend indexes all 21 files, builds the call graph, parses the query into a structured goal (extracts validation identifiers `port`, `serve`, `conflict`, `backend`), and traverses the dependency graph.
  * The Result Panel displays a **Multi-File Context**:
    * **Tier 1 (Active file `main.py`)**: Neural model line-pruned code.
    * **Tier 3 (Dependencies/Imports e.g. `database.py`, `user.py`)**: Interface declarations only (class definitions, function headers, method signatures).
  * Original tokens (978) are pruned down to ~340 tokens (**~65% tokens saved**), providing a highly dense prompt for LLM ingestion.

---

### Scenario 6: Interactive WebView UI Actions
* **Objective**: Copy the pruned context to the clipboard and insert it into the active editor.
* **Steps**:
  1. In the opened Result Webview, click the **`Copy Pruned Code`** button.
  2. Open a scratch file and press `Ctrl+V`. Verify that the pruned code was pasted successfully.
  3. Position your editor cursor on an empty line in `main.py`.
  4. Click the **`Insert At Cursor`** button in the webview.
* **Expected Result**:
  * `Copy` copies the pruned code to the clipboard.
  * `Insert` inserts the pruned code directly at the cursor line in `main.py`.

---

### Scenario 7: Resilient Error Handling (Downtime Fallback)
* **Objective**: Ensure that offline connections or backend issues do not crash the extension.
* **Steps**:
  1. Kill the backend terminal process (Press `Ctrl+C` in your backend server window).
  2. Run the `TokenWise: Check Backend Health` command.
  3. Run the `TokenWise: Prune Selected Code` command.
* **Expected Result**:
  * The Health check fails gracefully with: `TokenWise health check failed: FetchError / Connection Refused`.
  * Pruning fails gracefully with: `TokenWise prune failed: FetchError`.
  * The editor remains fully responsive without freezing or crashing.
