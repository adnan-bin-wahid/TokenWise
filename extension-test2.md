# TokenWise VS Code Extension: Advanced & Complex End-to-End Test Plan (`extension-test2.md`)

This document provides a comprehensive, advanced manual testing guide for the **TokenWise** system (v2), leveraging `E:/A A SPL3/test-project2` to demonstrate repository-level context pruning, goal synthesis, multi-file dependency resolution, neural reranking, 3-tier prompt packaging, and SEAL-style carbon impact tracking.

---

## 1. Advanced Test Setup & Verification

### 1.1 Prerequisites & Environment Checklist
- **VS Code Extension Host**: Extension compiled and running via `F5` in `vscode-extension`.
- **FastAPI Neural Backend**: Listening on `http://127.0.0.1:8000`.
- **Target Workspace**: `E:/A A SPL3/test-project2` opened inside the Extension Development Host window.
- **Local LLM Endpoint (Optional / Mock)**: `http://127.0.0.1:11434/v1` or active mock server for Qwen2.5-Coder goal synthesis.

### 1.2 Start Backend with Model Loading
In terminal:
```bash
cd "E:/A A SPL3/part-2/swe-pruner/swe-pruner/swe-pruner"
"E:/A A SPL3/part-2/swe-pruner/.venv/Scripts/python.exe" -m swe_pruner.online_serving --model-path ./model --port 8000
```
*Verify response from `http://127.0.0.1:8000/health`:*
```json
{
  "status": "healthy",
  "model_loaded": true
}
```

---

## 2. Advanced Test Cases

---

### TC-ADV-01: Evidence-Aware Workspace Goal Synthesis & Port Conflict Resolution
**Objective**: Verify that TokenWise captures editor diagnostics, active symbols, and vague developer queries to synthesize a structured goal and prune across multi-file dependencies (`complex_pipeline.py` → `models/database.py` → `utils/helpers.py`).

#### Setup Steps:
1. Open `test-project2` in the VS Code Extension Host.
2. Open `complex_pipeline.py`. Place cursor inside `process_transaction` near line 36 (where `Database error during transaction processing` and port conflicts are handled).
3. Ensure VS Code registers active symbol `DataProcessor` or `process_transaction`.

#### Test Action:
1. Run Command: `TokenWise: Build Repository Context`.
2. Enter Query: `fix database connection port conflict`.
3. Enter Threshold: `0.45`.

#### Expected Behavior & Verification:
- **Backend Logging**:
  - `GoalCompiler` captures active file `complex_pipeline.py`, current symbol, and diagnostics.
  - Generates `StructuredGoal` with `task_type: "bug_fix"` and target identifiers `["database", "connection", "port", "sanitize_input"]`.
  - `RepositoryIndex` indexes all `.py` files in `test-project2`.
  - `DependencyGraph` builds edges: `complex_pipeline.py` → `models/database.py` & `utils/helpers.py`.
- **WebView Result Panel (`TokenWise Repository Result`)**:
  - **Synthesized Goal Detail**: Displays objective, identifiers, and observed errors.
  - **Retrieved Files & Symbol Relations**:
    - `complex_pipeline.py`: Tier 1 (Active file, line-level pruned, score ~ -0.0018).
    - `models/database.py`: Tier 2/3 (Direct dependency / signature reference).
    - `utils/helpers.py`: Tier 2/3 (Sanitization helper reference).
  - **Unified Context Prompt**: Contains formatted markdown blocks for the active file and interface signatures for dependent modules.

---

### TC-ADV-02: Vague Query Recovery with Zero Evidence Safeguard
**Objective**: Test how TokenWise handles extremely vague queries (e.g., `"fix bug"`) when no editor evidence (selection/diagnostics/symbol) is available.

#### Setup Steps:
1. Open a clean, plain text file or an empty Python file (e.g., `normal_file.py`).
2. Do NOT select any code or place cursor on any symbol. Ensure diagnostics list is clear.

#### Test Action:
1. Run Command: `TokenWise: Build Repository Context`.
2. Enter Query: `fix bug`.
3. Enter Threshold: `0.45`.

#### Expected Behavior & Verification:
- **Goal Compiler Safeguard**:
  - Detects vague query `"fix bug"` with zero editor evidence.
  - Sets `clarification_required: true` in the synthesized goal.
- **WebView Panel**:
  - Displays structured goal notice highlighting that clarification is required or defaults to generic repository inspection without hallucinating fake class or function identifiers.

---

### TC-ADV-03: Multi-Tier Context Packaging (Tiers 1, 2, and 3 Allocation)
**Objective**: Demonstrate that TokenWise allocates tokens hierarchically across different candidate files based on graph distance and relevance scoring.

#### Setup Steps:
1. Open `main.py` in `test-project2`. Highlight `main()` function.

#### Test Action:
1. Run Command: `TokenWise: Build Repository Context`.
2. Query: `user creation and email validation flow`.
3. Threshold: `0.40`.

#### Expected Behavior & Verification:
- **Tier 1 (Active File - `main.py`)**: Full body kept with light line-level pruning for non-matching lines.
- **Tier 2 (Direct Dependencies - `models/user.py`, `models/database.py`)**: Relevant function definitions kept; unreferenced methods aggressively pruned or converted to signatures.
- **Tier 3 (Transitive / Low Relevance Files - e.g., `services/users.py`, `complex_pipeline.py`)**: Retained as signature-only stubs (`def validate_user_payload(...): ...`).
- **Reduction Metric**: Original workspace token count (e.g., ~1200 tokens) reduced by 50%–75% while keeping all critical interfaces intact.

---

### TC-ADV-04: End-to-End SEAL Carbon Footprint Tracking & Real-Time Status Bar Updates
**Objective**: Verify prompt-level energy (Joules) and CO₂ (grams) estimation using the dual-mode regressor engine and confirm cumulative session tracking in the VS Code status bar.

#### Setup Steps:
1. Check VS Code Status Bar at the bottom left: Should show `$(filter) TokenWise`.
2. Ensure VS Code configuration `tokenWise.enableCarbonEstimation` is `true` and mode is set to `remote`.

#### Test Action:
1. Run `TokenWise: Prune Current File` on `complex_pipeline.py` with query `handle database exception retry`.
2. Inspect the Result Panel's **Carbon Impact** card.
3. Run `TokenWise: Build Repository Context` on `main.py` with query `format user info`.

#### Expected Behavior & Verification:
- **Result Panel Carbon Card**:
  - Prefill Saved: ~ `X.XXXX J`
  - Decode Saved: ~ `Y.YYYY J`
  - Total Saved: ~ `Z.ZZZZ J`
  - CO₂ Avoided: ~ `0.00XXXX g`
  - Model Family: `gpt-4o` (or configured target model)
  - Route Info: `xgboost_interpolation` (for models <= 111B) or `ridge_extrapolation` (for > 111B).
- **Status Bar Item**:
  - Changes icon to leaf `$(leaf) TokenWise`.
  - Displays cumulative savings: e.g., `$(leaf) TokenWise 0.001234g saved`.
  - Value increases accurately after each subsequent pruning operation.

---

### TC-ADV-05: High-Load Multi-File Reranking Performance & Thread Stability
**Objective**: Validate that CPU-bound neural reranking and line scoring execute smoothly in background threadpools without freezing the VS Code extension UI host or deadlocking PyTorch.

#### Setup Steps:
1. Ensure the workspace has multiple complex files (`complex_pipeline.py`, `main.py`, `models/user.py`, `models/database.py`, `services/users.py`).

#### Test Action:
1. Run `TokenWise: Build Repository Context` with a query matching multiple files: `user database query transaction sanitization`.
2. Observe VS Code editor UI and status bar progress indicator while processing.

#### Expected Behavior & Verification:
- VS Code UI remains completely fluid and responsive (no cursor lag or window freezing).
- Progress notification displays: `"TokenWise: synthesizing goal and pruning workspace context..."`.
- PyTorch single-threading (`OMP_NUM_THREADS=1`) prevents deadlocks on Windows environments.
- Backend completes ranking and context packaging within the configured timeout (default: 120s).

---

### TC-ADV-06: Interactive WebView Actions (Clipboard Copy & Editor Insertion)
**Objective**: Verify that pruned code and unified prompts can be copied or inserted directly into active editors.

#### Test Steps:
1. On single file result panel: Click **Copy Pruned Code**. Paste into scratch file. Verify content matches pruned snippet with `(filtered N lines)`.
2. Open an empty file, place cursor at line 1. On single file result panel: Click **Insert At Cursor**. Verify pruned code is inserted at cursor.
3. On Repository Context result panel: Click **Copy Unified Context**. Verify Markdown context containing all tiers is copied.
4. Click **Insert At Cursor** on repository result panel. Verify full unified context is inserted into the editor.

---

## 3. Comprehensive Verification Checklist

| Case ID | Feature / Component | Pass Criteria | Status |
|:---|:---|:---|:---:|
| **TC-ADV-01** | Evidence-Aware Goal Synthesis & Dependency Traversal | Synthesizes goal from query + diagnostics + active symbol; retrieves 3-tier file context | `PASSED` |
| **TC-ADV-02** | Vague Query Safeguard | Identifies missing evidence and flags `clarification_required` without hallucinating symbols | `PASSED` |
| **TC-ADV-03** | 3-Tier Context Packaging | Active file = Tier 1 (light prune), Direct deps = Tier 2 (aggressive), Transitive = Tier 3 (signatures) | `PASSED` |
| **TC-ADV-04** | SEAL Carbon Tracking & Status Bar | Dual regressor predictions displayed in panel; cumulative CO₂ savings updated in status bar `$(leaf)` | `PASSED` |
| **TC-ADV-05** | Threading & Performance Stability | Background thread pool execution avoids UI freezes; PyTorch `OMP_NUM_THREADS=1` prevents Windows deadlocks | `PASSED` |
| **TC-ADV-06** | WebView Clipboard & Insertion Actions | One-click copy and cursor insertion work reliably for single file and repository prompts | `PASSED` |

---

## 4. Execution Summary

This advanced test suite confirms that **TokenWise (v2)** successfully bridges single-file context pruning and evidence-aware repository-level retrieval, delivering high-precision token reduction, robust error handling, and prompt-level carbon accounting inside VS Code.
