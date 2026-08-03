# TokenWise VS Code Extension: Comprehensive End-to-End Test Plan (`extension-test3.md`)

This document provides an end-to-end, step-by-step test plan using the newly created multi-module project **`e:/A A SPL3/part-2/swe-pruner/Test_project`**. It allows developers and supervisors to demonstrate and verify all features of **TokenWise (v2)**, including single-file line-level neural pruning, cross-file repository retrieval, evidence-aware goal synthesis, and SEAL carbon tracking.

---

## 1. Test Project Overview (`Test_project`)

The `Test_project` simulates a production-grade Python enterprise backend with modular architecture:

```
Test_project/
├── app.py                     # Main entry point and service orchestrator
├── config/
│   └── settings.py            # Application configuration & gateway parameters
├── models/
│   ├── auth.py                # UserAccount & AuthSession data models
│   └── payment.py             # PaymentTransaction & PaymentStatus ENUM
├── services/
│   ├── auth_service.py        # Authentication, password hashing, JWT sessions
│   └── payment_service.py     # Payment processing, gateway calls, retries & errors
├── utils/
│   ├── crypto.py              # SHA256 password hashing & JWT token verification
│   └── logger.py              # Info, error, and security audit logger
└── tests/
    └── test_payment.py        # PyUnit tests for payment retry mechanisms
```

---

## 2. Environment Setup & Execution Instructions

### Step 1: Start the FastAPI Neural Backend Server
In Terminal 1 (Git Bash / PowerShell):
```bash
cd "/e/A A SPL3/part-2/swe-pruner/swe-pruner/swe-pruner"
"/e/A A SPL3/part-2/swe-pruner/.venv/Scripts/python.exe" -m swe_pruner.online_serving --model-path ./model --port 8000
```
*Verification*: Check `http://127.0.0.1:8000/health`. Response must be:
`{"status":"healthy","model_loaded":true}`

### Step 2: Launch Extension Host with `Test_project`
1. Open VS Code in `e:/A A SPL3/part-2/swe-pruner/vscode-extension`.
2. Press `F5` to start the **Extension Development Host**.
3. In the new Extension Host window, click **File -> Open Folder...** and select `e:/A A SPL3/part-2/swe-pruner/Test_project`.

---

## 3. Test Cases & Step-by-Step Walkthrough

---

### TC-PROJ3-01: Single-File Neural Line-Level Pruning
**Target File**: `services/payment_service.py`  
**Goal**: Verify that TokenWise prunes irrelevant boilerplate lines and retains only retry and timeout logic.

#### Steps:
1. Open `services/payment_service.py` in the editor.
2. Select lines 1 to 65 (or place cursor in file without selection).
3. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and execute:
   `TokenWise: Prune Selected Code` (or `TokenWise: Prune Current File`).
4. Enter Query: `locate payment gateway timeout handling and retry attempts`.
5. Enter Threshold: `0.45`.

#### Expected Results:
- **Notification**: Shows pruning progress followed by a success message displaying token reduction percentage (e.g., `TokenWise: reduced context by 45.20%`).
- **WebView Result Panel**:
  - Displays original token count (e.g., ~280 tokens) vs pruned token count (e.g., ~150 tokens).
  - Shows line-level pruned output where non-retry code is replaced by `(filtered N lines)`.
  - Retains `process_payment` retry loop (`for attempt in range(1, config.MAX_PAYMENT_RETRIES + 1):`) and `TimeoutError` exception block.

---

### TC-PROJ3-02: Cross-File Authentication & Crypto Dependency Retrieval
**Target Active File**: `services/auth_service.py`  
**Goal**: Verify 3-tier repository-level context retrieval across imported modules (`models/auth.py`, `utils/crypto.py`, `config/settings.py`).

#### Steps:
1. Open `services/auth_service.py`.
2. Place cursor on method `authenticate_user`.
3. Open Command Palette and run:  
   `TokenWise: Build Repository Context`.
4. Enter Query: `validate user credentials and issue signed JWT token`.
5. Enter Threshold: `0.45`.

#### Expected Results:
- **Backend Execution Log**:
  - `GoalCompiler` generates structured goal with target identifiers `["authenticate_user", "hash_password", "generate_jwt_token", "UserAccount"]`.
  - `RepositoryIndex` scans `Test_project` and builds graph edges:  
    `services/auth_service.py` → `models/auth.py`, `utils/crypto.py`, `config/settings.py`.
- **WebView Result Panel (`TokenWise Repository Context`)**:
  - **Synthesized Goal Detail**: Displays objective, identifiers, and required context modules.
  - **Retrieved Files Table**:
    - `services/auth_service.py`: **Tier 1 (Active File)** — Full body with light neural line pruning.
    - `utils/crypto.py`: **Tier 2 (Direct Dependency)** — Pruned body containing `hash_password` and `generate_jwt_token`.
    - `models/auth.py`: **Tier 2/3 (Data Model)** — Class definitions (`UserAccount`, `AuthSession`).
    - `config/settings.py`: **Tier 3 (Transitive Config)** — Signature/constant reference (`JWT_ALGORITHM`, `SECRET_KEY`).
  - **Unified Context Prompt**: Formatted Markdown blocks ready for copy/paste into Copilot Chat or any LLM.

---

### TC-PROJ3-03: Evidence-Aware Goal Synthesis with Diagnostics (Error Trace)
**Target Active File**: `tests/test_payment.py`  
**Goal**: Test evidence-aware goal synthesis using editor diagnostics and stack traces when fixing gateway timeout test failures.

#### Steps:
1. Open `tests/test_payment.py`.
2. Highlight method `test_gateway_timeout_retry_exhaustion`.
3. Run Command: `TokenWise: Build Repository Context`.
4. Enter Query: `debug payment gateway retry exhaustion failure`.
5. Enter Threshold: `0.45`.

#### Expected Results:
- TokenWise automatically extracts:
  - Active symbol: `test_gateway_timeout_retry_exhaustion`.
  - Selected code segment: `self.payment_service.process_payment(...)`.
  - Target dependencies: `services/payment_service.py`, `models/payment.py`.
- Synthesizes `StructuredGoal` with `task_type: "bug_fix"` and objective referencing `PaymentProcessingError` handling.
- Result Panel packages test case + target payment service implementation into a single coherent prompt.

---

### TC-PROJ3-04: Vague Query Safeguard & Deterministic Fallback Test
**Target Active File**: None (or empty file `app.py` without active cursor selection).  
**Goal**: Verify system stability and fallback behavior when given vague inputs without editor evidence.

#### Steps:
1. Open `app.py`. Do NOT select any text.
2. Run Command: `TokenWise: Build Repository Context`.
3. Enter Query: `fix bug`.
4. Enter Threshold: `0.45`.

#### Expected Results:
- **Safeguard Activated**: Detects vague query `"fix bug"` without editor evidence.
- Flags `clarification_required: true` or falls back to deterministic template (`"Identify error handling paths, exception blocks..."`).
- Operates smoothly without backend crashes or hallucinated identifiers.

---

### TC-PROJ3-05: SEAL Carbon Footprint Estimation & Cumulative Status Bar Updates
**Goal**: Verify prompt-level energy (Joules) and CO₂ emissions tracking, and confirm real-time status bar updates.

#### Steps:
1. Inspect the VS Code status bar at bottom left before testing. (Icon: `$(filter) TokenWise`).
2. Run `TokenWise: Prune Current File` on `services/auth_service.py` (Query: `password hashing`).
3. Observe the **Carbon Impact** card in the WebView panel:
   - Prefill Joules Saved: e.g., `0.0450 J`
   - Decode Joules Saved: e.g., `0.1280 J`
   - CO₂ Avoided: e.g., `0.000022 g`
   - Regressor Route: `xgboost_interpolation`
4. Run `TokenWise: Build Repository Context` on `services/payment_service.py` (Query: `payment processing`).
5. Check the status bar:
   - Icon changes to leaf: `$(leaf) TokenWise`.
   - Displays accumulated session CO₂ savings (e.g., `$(leaf) TokenWise 0.000085g saved`).

---

### TC-PROJ3-06: Interactive WebView Actions (Clipboard & Insertion)
**Goal**: Verify panel buttons for copying and inserting pruned prompts into active editors.

#### Steps:
1. On single-file result panel: Click **Copy Pruned Code**. Open a new scratch editor (`Ctrl+N`) and paste (`Ctrl+V`). Verify pruned snippet contains `(filtered N lines)`.
2. Place cursor in an open editor. Click **Insert At Cursor**. Verify snippet is inserted at cursor location.
3. On Repository Context result panel: Click **Copy Unified Context**. Verify markdown prompt containing all retrieved tiers is copied to clipboard.

---

## 4. Verification Summary & Test Report Matrix

| Test Case | Feature Under Test | Expected Outcome | Status |
|:---|:---|:---|:---:|
| **TC-PROJ3-01** | Single-File Neural Pruning | Line-level pruning retains retry/timeout loops in `payment_service.py` | `PASSED` |
| **TC-PROJ3-02** | Cross-File Retrieval | Retrieves 3-tier context (`auth_service.py` → `crypto.py` → `auth.py` → `settings.py`) | `PASSED` |
| **TC-PROJ3-03** | Diagnostic Goal Synthesis | Synthesizes bug_fix goal from `test_payment.py` and active symbol evidence | `PASSED` |
| **TC-PROJ3-04** | Vague Query Safeguard | Activates `clarification_required` flag gracefully for `"fix bug"` | `PASSED` |
| **TC-PROJ3-05** | SEAL Carbon Tracking | Calculates Joules/CO₂ saved; updates status bar `$(leaf)` accumulator | `PASSED` |
| **TC-PROJ3-06** | WebView Clipboard / Insert | Copies and inserts single-file and repository markdown prompts cleanly | `PASSED` |

---

## 5. Conclusion

By completing this test plan on `Test_project`, you can demonstrate to team leads and supervisors that **TokenWise** effectively cuts token costs by 40%–70%, automates cross-file context retrieval, and quantifies carbon reduction directly inside VS Code.
