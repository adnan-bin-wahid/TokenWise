# TokenWise: Sustainable Context Optimization for Coding Agents

TokenWise is a Visual Studio Code extension and supporting Python FastAPI service designed to reduce context bloat, retain logic structures, and model the environmental footprint of coding assistants. Powered by the **SWE-Pruner** paper's line-level skimming logic and the **SEAL** paper's carbon estimation framework, TokenWise helps developers compress context intelligently and sustainably.

---

## 🏗️ System Architecture & Subsystems

1. **Goal-Driven Hint Generation:** Compiles user queries combined with active file info, cursor symbol, selected code, and diagnostics into a machine-readable `StructuredGoal` JSON using Qwen2.5-Coder (or falls back to regex-based intent classification).
2. **Line-Level Neural Skimming:** Uses a fine-tuned transformer (`ayanami-kitasan/code-pruner`) with multi-head attention fusion and a Conditional Random Field (CRF) / Feed-Forward Network (FFN) compression head to score and prune code at line granularity.
3. **Adaptive Context Pruning:** Traverses the repository call/import graph to classify modules into Tier 1 (lightly pruned), Tier 2 (aggressively pruned), or Tier 3 (replaced with AST function/class signature stubs).
4. **Phase-Specific Dual Regressor Carbon Estimation:** Evaluates inference prefill/decode energy draw independently using XGBoost (interpolation for <=111B parameters) and Ridge regression models (extrapolation for >111B parameters) trained on hardware energy profiles from the SEAL dataset.

---

## ⚙️ Prerequisites (Fresh PC Setup)

Ensure your system has the following installed before beginning setup:

- **Python 3.12.x** (Verify with `python --version`)
- **Node.js** & **npm** (Verify with `node -v` and `npm -v`)
- **Git** (Verify with `git --version`)
- **Hugging Face CLI** (`pip install huggingface_hub[cli]` - Verify with `huggingface-cli --help`)
- **VS Code**

> **Note for Windows Users:** If you run into execution policy restrictions while activating the virtual environment in PowerShell, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

## 🚀 Step-by-Step Installation & Setup

Follow these steps sequentially to set up and run TokenWise on your machine.

### 1. Set Up the Python Backend & Model

1. Open your terminal (Git Bash or PowerShell) and navigate to the project directory:
   ```bash
   cd "/e/A A SPL3/part-2/swe-pruner"
   ```

2. Create a virtual environment at the repository root:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   * **Git Bash:**
     ```bash
     source .venv/Scripts/activate
     ```
   * **PowerShell:**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```

4. Upgrade `pip` and install the package dependencies in editable mode:
   ```bash
   cd swe-pruner/swe-pruner
   pip install --upgrade pip
   pip install torch --index-url https://download.pytorch.org/whl/cu126  # Or CPU: pip install torch
   pip install -e .
   ```

5. Download the pre-trained neural pruner model files from Hugging Face:
   ```bash
   huggingface-cli download ayanami-kitasan/code-pruner --local-dir ./model
   ```
   *Verify downloaded files:* `ls -lh ./model` should show `model.safetensors` (~1.3 GB) along with configuration files.

### 2. Start the FastAPI Service

Start the backend server on port 8000:
```bash
python -m swe_pruner.online_serving --model-path ./model --port 8000
```
Keep this terminal running. Verify the service is online from another terminal using:
```bash
curl -sS http://127.0.0.1:8000/health
```
**Expected response:** `{"status":"healthy","model_loaded":true}`

### 3. Compile the VS Code Extension

1. Open a new terminal window and navigate to the extension directory:
   ```bash
   cd "/e/A A SPL3/part-2/swe-pruner/vscode-extension"
   ```

2. Install Node dependencies and compile the TypeScript source files:
   ```bash
   npm install
   npm run compile
   ```

---

## 🎮 Running and Testing TokenWise in VS Code

### Step 1: Launch the Extension Development Host

1. Open the directory `/e/A A SPL3/part-2/swe-pruner/vscode-extension` in VS Code.
2. Press **F5** (or go to *Run and Debug* and click **Start Debugging**).
3. A new VS Code window will launch with the TokenWise extension active.

### Step 2: Open the Sandbox Test Project

1. In the newly opened *Extension Development Host* window, select **File -> Open Folder...**
2. Open the demo folder: `e:/A A SPL3/part-2/swe-pruner/Test_project`.
3. Locate the status bar item in the bottom-left corner. It should say `$(filter) TokenWise` (or a green leaf if carbon savings have already accumulated). Click it to confirm health!

### Step 3: Run the Commands

You can run the following commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

#### 1. `TokenWise: Check Backend Health`
Checks if the local API server and model are loaded properly.

#### 2. `TokenWise: Prune Current File` (or `Prune Selected Code`)
- Open `Test_project/services/payment_service.py`.
- Run the command.
- Enter a query like `optimize retry mechanism and gate timeouts`.
- Click **Enter** (default threshold: 0.45).
- A side-panel **TokenWise Result** Webview opens. It displays the original and pruned code side-by-side, kept fragments, reduction statistics, and the SEAL carbon savings estimate.

#### 3. `TokenWise: Build Repository Context`
- Select `Test_project/app.py` or place your cursor in `app.py`.
- Run the command.
- Enter a search query like `fix database payment transactions`.
- The extension performs evidence-aware goal synthesis, builds a call/dependency graph of `Test_project`, reranks candidates, and divides files into Tier 1 (app.py - lightly pruned), Tier 2 (payment_service.py - aggressively pruned), and Tier 3 (stubs only).
- The resulting Webview includes a detailed **Synthesized Goal card**, a **File-level summary grid**, and the **Unified Context Prompt** ready to copy/insert.

---

## 🧪 Comprehensive Manual Tests

To verify full system correctness, refer to these step-by-step test plans:

- **Command Line Sanity Checks:** [Manual-test.txt](Manual-test.txt) (contains raw `curl` payloads, health verify scripts, and shutdown commands).
- **Workspace-Level Test Suite:** [extension-test3.md](extension-test3.md) (uses `Test_project` for validation of graph hop-distances, stub generation, and diagnostics ingestion).

---

## 🔧 Troubleshooting

### 1. `422 Unprocessable Entity` on API requests
* **Cause:** Malformed JSON payload (usually trailing commas in inputs).
* **Fix:** Ensure JSON inputs have no trailing commas before closing braces.

### 2. Hugging Face LFS Download Fails
* **Cause:** GitHub LFS traffic/quota restrictions on upstream repository.
* **Fix:** Use the recommended `huggingface-cli download` command shown in setup step 1.

### 3. Port 8000 Already in Use
* **Cause:** A background FastAPI process is already running.
* **Fix:** Run this command in Git Bash to kill the offending process:
  ```bash
  netstat -ano | grep :8000 | grep LISTENING | awk '{print $5}' | xargs -r taskkill //F //PID
  ```

### 4. PowerShell script execution blocked
* **Cause:** Strict default security policy in Windows.
* **Fix:** Set execution bypass for the process: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

---

## 📂 Project Structure

```text
swe-pruner/
├── vscode-extension/         # TypeScript VS Code extension (commands & WebView results UI)
├── Test_project/             # Multi-module sandbox Python project for end-to-end verification
├── swe-pruner/               # Python code optimization server & libraries
│   └── swe-pruner/
│       ├── model/            # Downloaded Qwen3-Reranker model weights (safetensors)
│       ├── carbon_artifacts/ # Persisted energy regressors and feature schemas
│       ├── src/swe_pruner/
│       │   ├── online_serving.py  # FastAPI server entry point
│       │   ├── prune_wrapper.py   # Core neural line skimmer interface
│       │   ├── carbon_estimator.py # SEAL-based phase-specific energy predictor
│       │   ├── goal_compiler.py   # Query context goal compiler
│       │   └── repository/        # AST python module parsing & import resolvers
│       └── pyproject.toml    # Python project packaging metadata
└── carbon-engine/            # Scikit-learn & XGBoost model training codebase
```

---

## 📄 License & References

- **License:** MIT License. See [LICENSE](LICENSE) for details.
- **Reference Papers:**
  - *SWE-Pruner:* [arXiv:2601.16746](https://arxiv.org/abs/2601.16746)
  - *SEAL:* [arXiv:2501.12345](https://arxiv.org/abs/2501.12345) (conceptual energy modeling framework)
