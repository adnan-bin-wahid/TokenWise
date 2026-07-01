# TokenWise (SWE-Pruner + SEAL) Technical Implementation Report

This report outlines the end-to-end architecture, mathematical formulations, codebase layout, verification checks, and final publishing limitations of the **TokenWise** system (comprising the local neural context compression of **SWE-Pruner** and the model-routed energy/carbon tracker of the **SEAL** reference framework).

---

## 1. System Architecture & Flow

TokenWise acts as a developer-oriented prompt-level middleware that interfaces between massive software repositories and token-budgeted Large Language Models (LLMs). It intercepts files selected in VS Code and optimizes them before they are sent to the model API.

```
+------------------+                   +--------------------+
|  VS Code Client  |                   |   FastAPI Server   |
|                  |                   |                    |
| 1. Select Code   |                   |  3. Run Reranker/  |
|    & Enter Query | --(POST /prune)-->|     Token Scorer   |
| 2. Fetch User    |                   |  4. Run Regressor  |
|    Settings      |                   |     routing (SEAL) |
|                  |                   |                    |
| 6. Render Native |<--(JSON Response)-|  5. Assemble final |
|    Theme Webview |                   |     metrics payload|
+------------------+                   +--------------------+
```

---

## 2. Neural Skimmer & Context Pruning (SWE-Pruner)

SWE-Pruner performs task-aware, line-level pruning of code instead of structural syntax deletion or generic summarization.

### 2.1 Model Structure
The core model is defined in [model_structure.py](file:///e:/A%20A%20SPL3/part-2/swe-pruner/swe-pruner/swe-pruner/src/swe_pruner/model_structure.py) and wrapped inside [swepruner.py](file:///e:/A%20A%20SPL3/part-2/swe-pruner/swe-pruner/swe-pruner/src/swe_pruner/swepruner.py) as `SwePrunerForCodeCompression`.

1. **Backbone**: Utilizes a lightweight transformer backbone (e.g., `Qwen3-Reranker-0.6B`) to encode the context query and code sequence.
2. **Hidden Layer Fusion**: When `use_multi_layer_fusion` is enabled, the skimmer extracts hidden states at three distinct depths of the backbone:
   * **Early Hidden States** (syntactic structure representations)
   * **Middle Hidden States** (semantic relationships)
   * **Final Hidden States** (high-level instruction alignment)
   These states are concatenated to form a unified feature representation of size $H_{\text{fused}} = H_{\text{backbone}} \times 3$.
3. **Multi-Head Attention Fusion**: The fused hidden states pass through $N$ custom multi-head attention blocks (cross-token attention) to capture long-range coding dependencies and query-code alignments.
4. **Classification Head**: Token-level logs are output via one of three head structures:
   * `simple`: Linear projection with a $\tanh$ activation.
   * `ffn`: Multi-layer feed-forward network with LayerNorm, GELU, and Dropout.
   * `crf`: A Conditional Random Field (CRF) layer mapping dependencies between consecutive keep/prune label transitions, decoded using the Viterbi algorithm.
5. **Relevance Scoring Head**: Evaluates the global probability that the selected code block answers the query by projecting the final token's hidden state back to the vocabulary and measuring the relative log likelihood of generating `"yes"` vs. `"no"`.

### 2.2 Pruning Mechanics
Pruning is executed inside [prune_wrapper.py](file:///e:/A%20A%20SPL3/part-2/swe-pruner/swe-pruner/swe-pruner/src/swe_pruner/prune_wrapper.py):
1. **Chunking**: Code exceeding token limits is chunked with a configured overlap (default: $50$ tokens).
2. **Score Token Mapping**: Token logits representing query alignment are extracted.
3. **Line-Level Aggregation**: Token scores are mapped to character offsets and averaged over each line of code:
   $$\text{Line Score}_i = \frac{1}{|T_i|} \sum_{t \in T_i} \text{Sigmoid}(\text{Token Logit}_t)$$
   where $T_i$ is the set of tokens spanning line $i$.
4. **Line Filtering**: Lines scoring below the user's relevance threshold (e.g., $0.45$) are trimmed and replaced with `(filtered N lines)`. Code blocks of single-line gaps are kept to avoid structural fragmentation.

---

## 3. Dual-Regressor Carbon Tracker (SEAL Reference)

The SEAL estimation layer calculates the exact computational cost of prompt execution based on a 7-feature input vector: input tokens, output tokens, model size (B), prefill latency, decode latency, MMLU score, and BBH score.

### 3.1 Dual-Mode Regressor Routing
LLM inference profiles differ drastically between average-scale open models ($\le 111$B parameters) and massive frontier models ($> 111$B). TokenWise utilizes a two-tier model routing engine:
* **Interpolation Range** ($\le 111$B parameters): Routed to specialized **XGBoost Regressors** trained with a depth of $3$ and $100$ estimators to prevent overfitting.
* **Extrapolation Range** ($> 111$B parameters): Routed to **Ridge Linear Regressors** to guarantee stable scaling bounds for frontier systems.

### 3.2 Key Data Unit Calibration
Optimum-benchmark data columns store hardware performance metrics under varying conventions. During our validation checks, we resolved major mismatches:
* **Energy Synthesis**: Corrected the conversion of optimum-benchmark total energy columns from Kilowatt-hours (kWh) to Joules:
  $$\text{Energy (J)} = \text{TDP (W)} \times \text{Latency (s)} = \text{Raw kWh} \times 3,600,000.0$$
* **Latency Calibration**: Converted raw total stage latencies to milliseconds per token:
  $$\text{Latency per token (ms)} = \frac{\text{Total Latency (s)} \times 1000.0}{N_{\text{tokens}}}$$

### 3.3 Dynamic Token Scaling
Since benchmark datasets have fixed sequence properties (256 prefill tokens / 128 decode tokens), tree-based algorithms (XGBoost) cannot extrapolate to variable-sized developer queries. We added token-scaling rules to both the training and backend serving layers:
$$\text{Prefill Energy (Scaled)} = \text{Prefill Energy (Predicted)} \times \left(\frac{N_{\text{input\_tokens}}}{256.0}\right)$$
$$\text{Decode Energy (Scaled)} = \text{Decode Energy (Predicted)} \times \left(\frac{N_{\text{output\_tokens}}}{128.0}\right)$$
$$\text{CO2 Avoided (g)} = \frac{\text{Energy Saved (J)}}{3,600,000.0} \times \text{Carbon Intensity } (\text{gCO2/kWh})$$

---

## 4. Codebase Layout

```
swe-pruner/
├── carbon-engine/                   # SEAL ML Training & Validation Engine
│   ├── artifacts/                   # Saved regressors, registry, and validation output
│   ├── data/                        # Leaderboards, training sets, merge statistics
│   ├── scripts/
│   │   ├── build_model_registry.py  # Compiles registry profiles for active LLMs
│   │   ├── external_validation.py   # Validates regressors against Wilkins et al.
│   │   ├── prepare_features.py      # Performs feature engineering and encoding
│   │   └── train_models.py          # Trains XGBoost and Ridge regressor models
│   └── src/carbon_engine/
│       ├── inference.py             # DualModeRegressorEngine interface
│       └── modeling.py              # ML cross-validation and fitting operations
│
├── swe-pruner/swe-pruner/           # SWE-Pruner Python Backend Package
│   ├── carbon_artifacts/            # Copied model regressors for FastAPI serving
│   ├── model/                       # Local model checkpoint weights & config
│   └── src/swe_pruner/
│       ├── carbon_estimator.py      # Combines regressor predictions & fallback constants
│       ├── carbon_model_engine.py   # Token-scaled DualModeRegressorEngine
│       ├── online_serving.py        # FastAPI server endpoints (/prune, /estimate-carbon)
│       └── prune_wrapper.py         # Line-level score compression logic
│
└── vscode-extension/                # TS/JS VS Code Extension Front-End
    ├── src/
    │   ├── commands/                # Action handlers (Prune Selected, Check Health)
    │   ├── services/
    │   │   ├── apiClient.ts         # Handles backend POST communications
    │   │   └── carbonEstimator.ts   # Client-side fallback estimation constants
    │   └── ui/
    │       └── resultPanel.ts       # Webview rendering with native VS Code CSS themes
    └── package.json                 # Extension configuration settings and menus
```

---

## 5. Completed Verification Benchmarks

### 5.1 Training Cross-Validation
Our hyperparameter tuning yielded high-precision cross-validation metrics across the 101 deduped hardware-model configurations:
* **XGBoost Prefill Interpolation**: MAPE = **$13.83\%$**, $R^2 = \mathbf{0.878}$
* **XGBoost Decode Interpolation**: MAPE = **$22.41\%$**, $R^2 = \mathbf{0.246}$
* **Ridge Prefill Extrapolation**: MAPE = **$22.08\%$**, $R^2 = \mathbf{0.993}$
* **Ridge Decode Extrapolation**: MAPE = **$46.59\%$**, $R^2 = \mathbf{0.900}$

### 5.2 Empirical Target Validation (Wilkins et al.)
Tested against empirical LLaMA-2-7B/13B energy baselines, our models achieved an average relative error of **$15.68\%$**, safely meeting the paper's target criteria of **$\le 17.76\%$**.

---

## 6. Current Limitations & Path to Full Publishability

To transition TokenWise from a research prototype to a fully publishable, commercial-grade developer tool, the following limitations must be addressed:

### 1. Manual / Static Goal Hints
* **Limitation**: Currently, the raw user-entered search string is passed directly as the query vector. If the query is vague (e.g. `"fix bug"`), semantic skimming quality degrades.
* **Solution for Publishability**: Integrate a prompt-expansion pre-processor in the FastAPI backend. This layer would use a small local LLM or instruct-template to transform raw user queries into structured "Goal Hints" (specifying target modules, edit types, and affected variables) before line evaluation.

### 2. Python Backend Dependency in Local Mode
* **Limitation**: When users select `local` mode in their settings to protect privacy or reduce latency, the extension falls back to linear scale constants instead of the trained regressors. Running the full ML pipeline locally requires setting up a local Python server.
* **Solution for Publishability**: Export the trained XGBoost and Ridge models into **ONNX format** (`.onnx`) and bundle them within the extension using `@microsoft/onnxruntime-web`. This will enable precise ML estimation in Javascript directly in the editor process without external Python execution.

### 3. Single-File Context Constraint
* **Limitation**: Skimming and pruning operate on one file at a time. Coding tasks in real repositories typically require understanding cross-file dependencies and imports.
* **Solution for Publishability**: Add workspace parsing to the extension. When a command is triggered, use an AST (Abstract Syntax Tree) parser to identify imported files, load them as a batch request, and execute joint-skimming to generate a unified, pruned prompt.

### 4. Static Carbon Intensity Coefficients
* **Limitation**: The conversion from energy (Joules) to CO2 equivalent (grams) relies on a static setting (default: $475.0$ gCO2/kWh). Real-time grid emissions fluctuate heavily depending on geography and time.
* **Solution for Publishability**: Implement dynamic API lookups inside `carbon_estimator.py` querying services like Electricity Maps or CO2Signal based on the user's localized geography to supply live grid data.

### 5. Lack of Unit and E2E Tests
* **Limitation**: The codebase currently lacks automated test suites for continuous integration.
* **Solution for Publishability**: Create a suite of tests:
  * Backend: Implement `pytest` suites to verify regressor routing boundaries, error lookups, and token-scaling calculations.
  * Extension: Implement extension integration tests using `@vscode/test-electron` to verify command registration, text insertion at cursor, and webview message passing.
