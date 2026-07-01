# TokenWise / SWE-Pruner v2 - Comprehensive Test Report

This report documents the E2E verification plan, testing scenarios, expected behavior, and verification results for the **TokenWise v2** extension and **SWE-Pruner** backend service. Follow this guide step-by-step to test the extension yourself.

---

## 1. Test Setup & Initialization

### 1.1 Start Backend Server
Run this command in the terminal inside your workspace directory to start the optimized FastAPI service (configured in single-thread mode to prevent OpenMP/proactor thread locks):
```powershell
$env:PYTHONPATH="swe-pruner/swe-pruner/src"; $env:SWEPRUNER_MODEL_PATH="swe-pruner/swe-pruner/model"; .venv\Scripts\python -m uvicorn swe_pruner.online_serving:app --host 127.0.0.1 --port 8000
```
* **Expected Output**: 
  ```
  INFO:swe_pruner.online_serving:Model loaded successfully from swe-pruner/swe-pruner/model
  INFO:     Application startup complete.
  INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
  ```

### 1.2 Open VS Code Extension Developer Host
To launch the VS Code window with the TokenWise extension active:
1. Open a new terminal and navigate to `e:\A A SPL3\part-2\swe-pruner\vscode-extension`.
2. Run `npm run compile` to build the typescript files.
3. Launch the host window targeting the test project:
   ```powershell
   code --extensionDevelopmentPath="e:\A A SPL3\part-2\swe-pruner\vscode-extension" "E:\A A SPL3\test-project2"
   ```
* **Expected Output**: A new VS Code instance opens showing the `test-project2` workspace. The Status Bar in the bottom left displays: `$(filter) TokenWise` (leaf/filter icon).

---

## 2. Step-by-Step Testing Scenarios

### Scenario 1: Health & Connectivity Verification
* **Objective**: Confirm the extension is communicating with the local FastAPI service.
* **Steps**:
  1. Inside the Extension Developer Host, press `Ctrl+Shift+P` (or `F1`).
  2. Search for and execute **`TokenWise: Check Backend Health`**.
* **Expected Result**: A VS Code info toast appears in the bottom right corner showing:
  `TokenWise backend healthy. Model: swe-pruner/swe-pruner/model loaded.`

---

### Scenario 2: Single-File Selected Code Pruning
* **Objective**: Select a chunk of code in an active editor, query it with a query intent and threshold, and verify line-level pruning.
* **Steps**:
  1. Open the file `main.py` in the Extension Host editor.
  2. Select the `login` function definition (lines 20-30).
  3. Right-click and choose **`TokenWise: Prune Selected Code`**.
  4. Query: `Check login details and session creation`.
  5. Threshold: `0.45`.
* **Expected Result**:
  * The TokenWise Result panel opens automatically.
  * Webview background, text, borders, and buttons match your current VS Code theme colors.
  * Side-by-side comparison: original code on the left, pruned code on the right showing kept lines and `(filtered X lines)` placeholders for pruned blocks.
  * Displays: Similarity Score, Token counts, and Token Reduction percentage.

---

### Scenario 3: Single-File Full Text Pruning
* **Objective**: Prune the entire active editor contents without selecting text.
* **Steps**:
  1. Clear any active text selection in `main.py`.
  2. Press `Ctrl+Shift+P` and choose **`TokenWise: Prune Current File`**.
  3. Query: `Identify greeting endpoints`.
  4. Threshold: `0.40`.
* **Expected Result**:
  * The extension automatically extracts the entire file content.
  * Result panel updates, showing line-level pruning for the full file.

---

### Scenario 4: Multi-File Workspace Context Pruning (v2 Feature)
* **Objective**: Build structured task-aware goal context spanning imports, call graphs, and tests.
* **Steps**:
  1. Focus the active editor on `main.py`.
  2. Right-click inside the editor and choose **`TokenWise: Build Repository Context`**.
  3. Query: `fix backend startup port conflict`.
  4. Threshold: `0.45` (read from Settings config `tokenWise.defaultThreshold`).
* **Expected Result**:
  * The backend indexes the workspace (21 files), builds the call graph, constructs the structured goal (extracts query words `conflict`, `port`, `serve` as validation identifiers), and traverses the dependency graph.
  * The Webview panel opens showing the **Multi-File Unified Context**:
    * **Tier 1 (Active File `main.py`)**: Pruned line-by-line using the neural model.
    * **Tier 3 (Imports/Dependencies e.g. `database.py`, `user.py`)**: Interface declarations only (class/method definitions), saving up to **90%+** tokens.

---

### Scenario 5: Webview UI Interactions
* **Objective**: Test copying and inserting pruned code.
* **Steps**:
  1. Run any pruning scenario to open the Result Panel.
  2. Click **`Copy Pruned Code`** at the top right of the panel. Try pasting it somewhere to verify clipboard integration.
  3. Place your cursor inside an empty line in the editor, and click **`Insert At Cursor`** in the webview.
* **Expected Result**:
  * `Copy` successfully copies the pruned code block into your system clipboard.
  * `Insert` inserts the pruned text directly at the active cursor position in your editor.

---

### Scenario 6: Carbon Impact Estimations
* **Objective**: Verify SEAL prompt-level carbon impact values.
* **Steps**:
  1. Locate the **Carbon Estimation** section in the Result Panel.
  2. Compare Prefill/Decode energy consumption and CO2 emissions before and after pruning.
* **Expected Result**:
  * Displays saved energy in Joules (J) and saved CO2 in grams (g).
  * Shows estimation routes (`direct_lookup` or `ridge_extrapolation`).

---

### Scenario 7: Connection Failures & Error Handling
* **Objective**: Verify that backend downtime doesn't freeze the editor.
* **Steps**:
  1. Kill the backend terminal server process (Press `Ctrl+C` in the server terminal).
  2. Run the `TokenWise: Check Backend Health` command.
* **Expected Result**:
  * The command exits cleanly and displays: `TokenWise health check failed: FetchError/Connection refused`.
  * The VS Code UI remains fully responsive.
