# TokenWise — Complete Project Report

> **TokenWise** is a task-aware code context pruning system implemented as a VS Code extension backed by a FastAPI neural inference server. It intelligently removes irrelevant lines from source code before sending context to large language models (LLMs), reducing token costs, inference latency, and carbon emissions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Component Deep-Dive: SWE-Pruner Neural Model](#3-component-deep-dive-swe-pruner-neural-model)
4. [Component Deep-Dive: FastAPI Backend Server](#4-component-deep-dive-fastapi-backend-server)
5. [Component Deep-Dive: VS Code Extension](#5-component-deep-dive-vs-code-extension)
6. [Component Deep-Dive: Carbon Estimation Engine](#6-component-deep-dive-carbon-estimation-engine)
7. [Feature: Repository-Level Context Pruning (v2)](#7-feature-repository-level-context-pruning-v2)
8. [Feature: Goal Synthesis Layer](#8-feature-goal-synthesis-layer)
9. [Feature: Carbon Footprint Tracking](#9-feature-carbon-footprint-tracking)
10. [Data Flow: End-to-End Request Lifecycle](#10-data-flow-end-to-end-request-lifecycle)
11. [Configuration & Settings](#11-configuration--settings)
12. [Research Foundations](#12-research-foundations)

---

## 1. Project Overview

### What Problem Does TokenWise Solve?

Modern AI-assisted coding workflows (GitHub Copilot, Cursor, Aider, etc.) send large blocks of source code as context to LLMs. This creates three problems:

| Problem | Impact |
|---------|--------|
| **Token Cost** | LLM APIs charge per token. Sending 5000 tokens when only 800 are relevant wastes money. |
| **Latency** | Prefill latency scales linearly with input tokens. More tokens = slower responses. |
| **Carbon Emissions** | Every GPU inference cycle consumes electricity and produces CO₂. Unnecessary tokens amplify the environmental footprint. |

TokenWise solves all three by pruning irrelevant code lines **before** they reach the LLM, using a trained neural model that understands which lines are task-relevant.

### What Makes TokenWise Unique?

1. **Neural Line-Level Pruning** — Not keyword matching or regex. A trained Qwen3-Reranker-0.6B backbone scores every token for relevance, then aggregates scores to decide which lines to keep.
2. **Repository-Level Cross-File Context** — Not limited to a single file. It indexes the entire workspace, builds a dependency call graph, and retrieves related files.
3. **SEAL-Style Carbon Estimation** — Quantifies the exact CO₂ saved per pruning operation using trained XGBoost/Ridge regressors.
4. **Structured Goal Synthesis** — Transforms vague developer queries (e.g., "fix bug") into structured retrieval objectives using a local LLM.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                       │
│                                                                   │
│  ┌───────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Commands   │  │ PruneService │  │ ResultPanel (WebView)  │    │
│  │ pruneSelected │ → apiClient.ts│  │ HTML/CSS/JS dashboard  │    │
│  │ pruneFile  │  │ carbonEst.ts │  │ copy/insert actions    │    │
│  │ buildCtx   │  │ tokenCnt.ts  │  └────────────────────────┘    │
│  │ healthChk  │  └──────────────┘                                │
│  └───────────┘         │                                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTP (fetch)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python)                       │
│                                                                   │
│  Endpoints:                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ GET /health   │  │ POST /prune  │  │ POST /prune-workspace│   │
│  └──────────────┘  └──────┬───────┘  └──────────┬──────────┘    │
│                           │                      │               │
│  ┌────────────────────────┼──────────────────────┼───────────┐  │
│  │           SwePrunerForCodePruning (PyTorch)                │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │Qwen3-Reranker│  │ CRFLayer     │  │ Multi-Layer      │ │  │
│  │  │0.6B Backbone │→ │ Compression  │  │ Fusion Attention │ │  │
│  │  └─────────────┘  │ Head         │  └──────────────────┘ │  │
│  │                    └──────────────┘                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │GoalCompiler  │  │RepositoryIdx │  │ CarbonEstimator       │  │
│  │ + LLM Client │  │ + DepGraph   │  │ XGBoost/Ridge Regress │  │
│  └──────────────┘  │ + Retrievers │  └───────────────────────┘  │
│                    └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                         │
                    (Optional)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            Local LLM (Ollama / LM Studio)                        │
│            Qwen2.5-Coder-1.5B-Instruct                          │
│            OpenAI-compatible /v1/chat/completions                 │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
swe-pruner/                          # Root workspace
├── vscode-extension/                # VS Code extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts             # Entry point, command registration
│   │   ├── types.ts                 # All TypeScript interfaces
│   │   ├── commands/                # Command handlers
│   │   │   ├── pruneSelected.ts     # Prune selected code
│   │   │   ├── pruneCurrentFile.ts  # Prune entire file
│   │   │   ├── buildRepositoryContext.ts  # Workspace pruning (v2)
│   │   │   └── checkHealth.ts       # Backend health check
│   │   ├── services/                # Business logic
│   │   │   ├── apiClient.ts         # HTTP client to backend
│   │   │   ├── pruneService.ts      # Orchestrates prune + carbon
│   │   │   ├── carbonEstimator.ts   # Local fallback carbon calc
│   │   │   ├── config.ts            # VS Code settings reader
│   │   │   └── tokenCounter.ts      # GPT tokenizer wrapper
│   │   ├── ui/
│   │   │   └── resultPanel.ts       # WebView HTML rendering
│   │   └── utils/
│   │       └── editor.ts            # Editor helpers (selection, query input)
│   └── package.json                 # Extension manifest & settings schema
│
├── swe-pruner/swe-pruner/           # Backend (Python)
│   ├── model/                       # Pre-trained model weights
│   │   ├── config.json              # SwePrunerConfig
│   │   └── model.safetensors        # Trained weights (safetensors)
│   ├── carbon_artifacts/            # Trained carbon regressors
│   │   ├── xgb_prefill_interpolation.json
│   │   ├── xgb_decode_interpolation.json
│   │   ├── ridge_prefill_extrapolation.pkl
│   │   ├── ridge_decode_extrapolation.pkl
│   │   ├── model_registry.json
│   │   └── feature_artifacts.json
│   └── src/swe_pruner/
│       ├── online_serving.py        # FastAPI server & endpoints
│       ├── prune_wrapper.py         # Inference wrapper, chunking, line aggregation
│       ├── swepruner.py             # HuggingFace model class
│       ├── model_structure.py       # TokenScorer neural architecture
│       ├── configuration.py         # HuggingFace config class
│       ├── carbon_estimator.py      # SEAL-style carbon estimator
│       ├── carbon_model_engine.py   # Dual-mode regressor engine
│       ├── goal_compiler.py         # Goal synthesis + deterministic fallback
│       ├── goal_generator_client.py # Local LLM API client
│       ├── goal_models.py           # StructuredGoal Pydantic model
│       ├── repository/              # Workspace indexing
│       │   ├── repository_index.py  # File walker + AST indexing
│       │   ├── python_indexer.py    # Python AST parser
│       │   └── dependency_graph.py  # Import/call graph builder
│       └── retrieval/               # Context retrieval pipeline
│           ├── lexical_retriever.py # Identifier matching in AST index
│           ├── graph_retriever.py   # BFS ego-graph traversal
│           ├── candidate_ranker.py  # Neural reranking with Qwen3
│           └── context_builder.py   # 3-tier context packaging
│
├── carbon-engine/                   # Standalone carbon engine (training)
│   └── src/carbon_engine/
│       ├── inference.py             # DualModeRegressorEngine
│       ├── features.py              # Feature engineering
│       ├── modeling.py              # Training pipeline
│       ├── merge.py                 # Dataset merging
│       ├── schema.py                # Data schema validation
│       └── registry.py              # Model registry management
│
└── carbon_artifacts/                # Root-level carbon model artifacts
```

---

## 3. Component Deep-Dive: SWE-Pruner Neural Model

### 3.1 The Research Foundation: SWE-Pruner Paper

The SWE-Pruner paper introduces a **task-aware code context compression** method that treats code pruning as a **sequence labeling problem**: given a query and a code document, classify each token as "keep" (1) or "prune" (0).

The key insight is that existing context window managers (like naive truncation or BM25 retrieval) lose critical semantic information. SWE-Pruner instead uses a trained neural model to understand **which specific lines** are relevant to a developer's task.

### 3.2 Model Architecture: `TokenScorer`

The neural model is implemented in `model_structure.py` and consists of three major components:

#### A. Backbone: Qwen3-Reranker-0.6B

The backbone is a 0.6 billion parameter causal language model from the Qwen3 family, specifically the reranker variant. It processes the concatenated query + code sequence and outputs hidden state representations at each layer.

```
Input: "<|im_start|>system\nJudge whether the Document meets..."
     + "<Instruct>: Given a web search query...\n<Query>: {query}\n<Document>: {code}"
     + "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
```

The instruction template wraps the code in a reranker-style format, which allows the backbone to leverage its pre-trained understanding of document relevance.

#### B. Multi-Layer Fusion Attention

Instead of using only the final hidden layer (which captures high-level semantics but loses low-level syntactic patterns), TokenWise fuses **three layers**:

| Layer | Ratio | What It Captures |
|-------|-------|-----------------|
| **Early** (Layer ~7) | 25% of depth | Token-level syntax, indentation, keywords |
| **Middle** (Layer ~14) | 50% of depth | Statement-level patterns, control flow |
| **Final** (Layer ~28) | 100% of depth | Semantic relationships, function purpose |

These three hidden states are **concatenated** (not averaged) to form a fused representation of size `3 × hidden_size`. This concatenated vector then passes through a multi-head self-attention fusion layer with residual connections and layer normalization:

```python
fused_hidden = torch.cat([early_hidden, middle_hidden, final_hidden], dim=-1)  # [B, L, 3H]
# Multi-head attention with residual connection
attn_output = MultiheadAttention(fused_hidden, fused_hidden, fused_hidden)
h = LayerNorm(attn_output + fused_hidden)
```

**Why this works**: Early layers know that `import` statements are structurally important. Middle layers understand that an `if` block guards a database query. Final layers know that the entire function is semantically related to "authentication". Fusing all three lets the model make nuanced keep/prune decisions.

#### C. Dual-Head Output

The model has **two output heads**:

1. **Compression Head (CRF)**: A Conditional Random Field that outputs per-token keep/prune emissions. The CRF captures **sequential dependencies** between adjacent tokens — if one line in a function is kept, adjacent lines in the same block are more likely to be kept too.

   ```python
   # CRF emission scores
   emissions = FeatureExtractor(fused_hidden)  # [B, L, 2]  (prune=0, keep=1)
   # Token logits = keep_emission - prune_emission
   token_logits = emissions[:, :, 1] - emissions[:, :, 0]
   ```

2. **Scoring Head**: Projects the last token's hidden state onto the vocabulary embedding matrix, then computes `log_softmax(yes_logit, no_logit)` to produce a document-level relevance score. This is used for file-level reranking in workspace mode.

   ```python
   last_hidden = h_for_scoring[batch_idx, last_token_idx]
   vocab_logits = last_hidden @ embedding_weight.T
   score = log_softmax([no_logit, yes_logit])[1]  # P(relevant)
   ```

### 3.3 Inference Pipeline: `prune_wrapper.py`

The `SwePrunerForCodePruning` class wraps the raw model into a usable inference API:

#### Step 1: Input Formatting

The query and code are wrapped in the Qwen3 instruction template:
```
<|im_start|>system
Judge whether the Document meets the requirements...
<|im_end|>
<|im_start|>user
<Instruct>: Given a web search query, retrieve relevant passages...
<Query>: fix authentication bug
<Document>: def login(user, password): ...
<|im_end|>
<|im_start|>assistant
<think>

</think>

```

#### Step 2: Chunking (for long files)

If the code exceeds the 8192-token context window (after accounting for template overhead), it is split into overlapping chunks. Each chunk is processed independently, and overlapping token scores are **averaged** to produce a unified score map.

```python
chunks = split_code_into_chunks(code, tokenizer, chunk_max_tokens, overlap=50)
for chunk_text, start_char, end_char in chunks:
    score, token_scores, offsets = model._process_single_chunk(query, chunk_text, ...)
    chunk_results.append((token_scores, offsets, start_char, end_char))
merged_scores, merged_offsets = merge_token_scores_from_chunks(code, chunk_results)
```

#### Step 3: Token-to-Line Aggregation

Token scores are aggregated to line scores by averaging all token scores that fall within each line's character range:

```python
for line_num, line_text in enumerate(lines):
    line_scores = [char_to_score[pos] for pos in range(line_start, line_end) if pos in char_to_score]
    if line_scores:
        line_score = mean(line_scores)
```

#### Step 4: Line Pruning

Lines with scores below the threshold are removed. A smart heuristic preserves single-line gaps (if only one line separates two kept blocks, it's kept too). Pruned sections are replaced with `(filtered N lines)` markers:

```python
if line_score >= threshold:
    keep(line)
else:
    filter(line)
# Output: "def login(user, password):\n    (filtered 3 lines)\n    return session"
```

### 3.4 Why the Model is Effective

1. **CRF Head**: Unlike independent token classification, the CRF captures transition probabilities. If `line[i]` is kept, the probability of keeping `line[i+1]` increases — this mirrors real code structure where related logic spans multiple lines.
2. **Multi-Layer Fusion**: Combining early/middle/final layers captures both syntactic (is this an import?) and semantic (is this function related to the query?) signals.
3. **Reranker Backbone**: Starting from a pre-trained reranker means the model already understands relevance scoring. Fine-tuning on code-specific tasks gives it domain knowledge.

---

## 4. Component Deep-Dive: FastAPI Backend Server

### 4.1 Server Initialization (`online_serving.py`)

The server is implemented as a FastAPI application with four endpoints:

```python
app = FastAPI(title="Code Pruning Service")
```

**Critical: Thread Safety Configuration**

PyTorch's OpenMP and MKL threading can deadlock when running inside an async event loop. The server explicitly forces single-threaded execution:

```python
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
torch.set_num_threads(1)
```

All CPU-bound operations (neural scoring, model inference) are offloaded to a background thread pool using `asyncio.to_thread()` to prevent blocking the event loop.

**Startup**: On startup, the server loads the pre-trained SwePruner model from the path specified by `SWEPRUNER_MODEL_PATH` environment variable. If the model is not found, it logs a warning but keeps `/estimate-carbon` available.

### 4.2 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Returns model load status |
| `/prune` | POST | Single-file line-level pruning |
| `/prune-workspace` | POST | Repository-level context pruning |
| `/estimate-carbon` | POST | SEAL-style energy/CO₂ estimation |

### 4.3 The `/prune` Endpoint

Accepts `{ query, code, threshold }` and returns:
- `pruned_code`: The pruned version with `(filtered N lines)` markers
- `score`: Document-level relevance score
- `token_scores`: Per-token scores for visualization
- `kept_frags`: Line numbers that were kept
- `origin_token_cnt` / `left_token_cnt`: Before/after token counts

### 4.4 The `/prune-workspace` Endpoint

This is the v2 feature. It orchestrates the full cross-file pipeline:

1. **Goal Synthesis** → Transforms the raw query into a `StructuredGoal`
2. **Repository Indexing** → Walks the workspace and parses all Python files via AST
3. **Dependency Graph** → Builds import/call edges between files
4. **Lexical Retrieval** → Finds files containing goal identifiers
5. **Graph Expansion** → BFS traversal to find related files (1-hop neighbors)
6. **Neural Reranking** → Scores candidate files using the model's scoring head
7. **3-Tier Context Packaging** → Assembles the final pruned prompt

---

## 5. Component Deep-Dive: VS Code Extension

### 5.1 Architecture

The extension is written in TypeScript and follows a clean separation:

- **Commands** (`commands/`) — Handle user interaction, prompt for query/threshold
- **Services** (`services/`) — Business logic, API calls, carbon estimation
- **UI** (`ui/`) — WebView panel rendering
- **Utils** (`utils/`) — Editor helpers

### 5.2 Command Registration (`extension.ts`)

On activation, the extension registers four commands and creates a status bar item:

```typescript
export function activate(context: vscode.ExtensionContext): void {
    const service = new PruneService();
    const panel = new ResultPanel();
    
    // Status bar: Shows "$(filter) TokenWise" initially
    // Updates to "$(leaf) TokenWise 0.001234g saved" after pruning
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusItem.text = "$(filter) TokenWise";
    statusItem.show();
}
```

### 5.3 Prune Selected Code (`pruneSelected.ts`)

1. Checks for active editor and text selection
2. Prompts for query via `showInputBox`
3. Prompts for threshold (default: 0.45)
4. Calls `service.prune(query, code, threshold)`
5. Opens result WebView panel
6. Shows notification with reduction percentage

### 5.4 Build Repository Context (`buildRepositoryContext.ts`)

This command collects **editor evidence** from the active VS Code state:

```typescript
// Evidence collected automatically:
const activeFile = document.uri.fsPath;           // Current file path
const language = document.languageId;              // "python", "typescript", etc.
const workspaceRoot = workspaceFolder.uri.fsPath;  // Workspace root
const selectedCode = document.getText(selection);   // Highlighted text
const currentSymbol = document.getText(wordRange);  // Word under cursor

// VS Code Diagnostics (errors/warnings from language servers)
const diagnostics = vscode.languages.getDiagnostics(document.uri)
    .filter(d => d.severity <= DiagnosticSeverity.Warning)
    .map(d => d.message);
```

All of this evidence is sent to the backend's `/prune-workspace` endpoint along with the user's raw query.

### 5.5 PruneService (`pruneService.ts`)

The `PruneService` class orchestrates the full prune + carbon estimation pipeline:

1. Calls `apiClient.prune(request)` to get pruned code
2. Counts tokens (before/after) using the `gpt-tokenizer` library
3. Estimates carbon impact (before/after) using either:
   - **Remote mode**: Calls `/estimate-carbon` endpoint (uses trained XGBoost/Ridge models)
   - **Local mode**: Uses built-in constant-based estimator (fallback)
4. Computes savings: `carbonBefore.co2Grams - carbonAfter.co2Grams`
5. Accumulates session-level CO₂ savings for the status bar display

### 5.6 Result Panel (`resultPanel.ts`)

The WebView panel renders two views:

**Single-File Prune View**:
- Query display
- Stats grid: Score, Original Tokens, Pruned Tokens, Reduction %
- Carbon Impact section: Prefill Saved, Decode Saved, Total Saved, CO₂ Avoided
- Side-by-side Original Code / Pruned Code panels
- Action buttons: Copy Pruned Code, Insert At Cursor

**Workspace Prune View**:
- Token stats: Original Workspace Tokens, Pruned Workspace Tokens, Total Reduction
- Synthesized Goal Detail: Task Type, Target Identifiers, Objective, Observed Errors
- Retrieved Files table: File Path, Relation, Tier, Orig. Tokens, Pruned Tokens, Rerank Score
- Unified Pruned Prompt (the final context ready to paste into an LLM)
- Action buttons: Copy Unified Context, Insert At Cursor

### 5.7 Token Counter (`tokenCounter.ts`)

Uses the `gpt-tokenizer` npm package (GPT-4 tokenizer compatible) for accurate token counting:

```typescript
import { encode } from "gpt-tokenizer";
export function countTokens(text: string): number {
    return encode(text).length;
}
```

Falls back to `Math.ceil(text.length / 4)` if tokenization fails.

---

## 6. Component Deep-Dive: Carbon Estimation Engine

### 6.1 The SEAL Framework

The carbon estimation follows the **SEAL (Sustainability Evaluation of AI LLMs)** framework, which models LLM energy consumption as a function of:

- **Prefill phase**: Processing all input tokens in parallel (compute-bound)
- **Decode phase**: Generating output tokens autoregressively (memory-bound)

### 6.2 Dual-Mode Regressor (`carbon_model_engine.py`)

The engine uses **two trained regressor models**, selected based on model size:

| Model Size | Route | Regressor | Rationale |
|------------|-------|-----------|-----------|
| ≤ 111B parameters | **XGBoost Interpolation** | Gradient-boosted trees trained on benchmark data | Dense training data available for models ≤111B |
| > 111B parameters | **Ridge Extrapolation** | Ridge regression with linear extrapolation | Sparse data for very large models; linear extrapolation is safer |

**Feature Vector** (8 dimensions):
```
[n_input_tokens, n_output_tokens, model_size_b, 
 latency_per_input_token_ms, latency_per_output_token_ms,
 gpu_encoded, mmlu_pro_score, bbh_score]
```

The regressors predict raw energy in Joules, which is then scaled by the actual token counts and converted to CO₂ grams:

```python
prefill = xgb_prefill.predict(features) * (n_input_tokens / 256.0)
decode = xgb_decode.predict(features) * (n_output_tokens / 128.0)
total_joules = prefill + decode
co2_grams = (total_joules / 3_600_000) * carbon_intensity_g_per_kwh
```

### 6.3 Model Registry (`carbon_artifacts/model_registry.json`)

Contains pre-computed feature vectors for known LLM families (GPT-4o, Claude-3.5-Sonnet, Llama-3-70B, etc.), including their model sizes, benchmark scores, and default GPU types. When a user specifies a known model, the system automatically fills in missing features from the registry.

### 6.4 Trained Artifacts

```
carbon_artifacts/
├── xgb_prefill_interpolation.json   # XGBoost model for prefill energy (≤111B)
├── xgb_decode_interpolation.json    # XGBoost model for decode energy (≤111B)
├── ridge_prefill_extrapolation.pkl  # Ridge model for prefill energy (>111B)
├── ridge_decode_extrapolation.pkl   # Ridge model for decode energy (>111B)
├── model_registry.json              # Known model feature vectors
├── feature_artifacts.json           # GPU type encoder mapping
├── cv_metrics.json                  # Cross-validation metrics
└── validation_report.json           # Validation metrics
```

---

## 7. Feature: Repository-Level Context Pruning (v2)

This is the primary v2 contribution that addresses the **single-file context constraint** from the original SWE-Pruner paper.

### 7.1 Pipeline Overview

```
User Query + Editor Evidence
        ↓
┌───────────────────────┐
│  1. Goal Synthesis    │  Raw query → StructuredGoal (via local LLM or deterministic fallback)
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  2. Repository Index  │  Walk workspace → Parse every .py file via Python AST
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  3. Dependency Graph  │  Resolve imports & function calls → Bidirectional adjacency list
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  4. Lexical Retrieval │  Search AST index for goal identifiers → Seed files
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  5. Graph Expansion   │  BFS from seeds → 1-hop ego-graph of related files
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  6. Neural Reranking  │  Score candidate files using Qwen3 scoring head
└───────────┬───────────┘
            ↓
┌───────────────────────┐
│  7. Context Packaging │  3-Tier assembly: Full prune / Aggressive prune / Signatures only
└───────────────────────┘
```

### 7.2 Repository Indexing (`repository_index.py` + `python_indexer.py`)

The `PythonASTIndexer` uses Python's built-in `ast` module to parse each `.py` file and extract:

- **Classes**: Name, start/end line, methods list, base classes, is_test flag
- **Functions**: Name, start/end line, is_test flag
- **Imports**: Module names (both `import X` and `from X import Y`)
- **Calls**: Function/method call names

The walker excludes standard directories (`.git`, `.venv`, `node_modules`, `__pycache__`, etc.).

### 7.3 Dependency Graph (`dependency_graph.py`)

Builds a **bidirectional** adjacency list:

- **`dependencies[A] = {B, C}`**: File A imports/calls symbols from files B and C
- **`dependents[B] = {A}`**: File B is imported/called by file A
- **`symbol_definitions["UserService"] = ["services/users.py"]`**: Maps symbol names to defining files

Import resolution uses suffix matching: if the import is `models.database`, it matches `models/database.py` by comparing path segments.

### 7.4 Lexical Retrieval (`lexical_retriever.py`)

Scans the AST index for exact matches of goal identifiers in class and function names. This produces the initial **seed file set**.

### 7.5 Graph Expansion (`graph_retriever.py`)

Performs a BFS traversal from the seed files, expanding outward by 1 hop in both directions (dependencies AND dependents). Returns a distance map:

```python
distances = {
    "main.py": 0,          # Seed (active file)
    "models/database.py": 1,  # 1-hop neighbor (imported by main.py)
    "utils/helpers.py": 1,    # 1-hop neighbor (called by main.py)
}
```

### 7.6 Neural Reranking (`candidate_ranker.py`)

For files that are either the active file or contain goal identifiers (verified with `\b` word boundary regex), the model's scoring head computes a relevance score. Files that don't match any identifiers are assigned a default low score (-5.0) and skipped from expensive neural evaluation.

The reranker uses the same Qwen3 instruction template as the pruner, but reads the `score_logits` output instead of `token_logits`:

```python
inputs = model.tokenizer(prefix + instruction_text + suffix, ...)
outputs = model(input_ids=inputs, attention_mask=mask)
score = float(outputs.score_logits[0].cpu().numpy())
```

**Python keyword filtering**: Common Python keywords (`def`, `class`, `import`, `for`, `in`, `self`, etc.) are excluded from identifier matching to prevent false positives (e.g., the query token `import` matching every file that contains an `import` statement).

### 7.7 3-Tier Context Packaging (`context_builder.py`)

Files are assigned to tiers based on their graph distance and reranking score:

| Tier | Criteria | Treatment | Token Budget |
|------|----------|-----------|-------------|
| **Tier 1** | Distance = 0 (active file) | **Light pruning** (threshold - 0.15) | Full body with irrelevant lines removed |
| **Tier 2** | Distance = 1 AND score > -2.0 | **Aggressive pruning** (threshold + 0.15) | Heavily pruned body |
| **Tier 3** | Everything else | **Signatures only** | Class/function declarations with `def func(...): ...` |

The output format is a structured prompt:

```markdown
### complex_pipeline.py
# Relation: active file
# Tier: 1 (original lines: 1-45)
```python
class DataProcessor:
    def __init__(self, db_url: str):
        self.db = DatabaseConnection(db_url)
    def process_transaction(self, raw_data: str, user_id: int) -> bool:
        clean_data = sanitize_input(raw_data)
        (filtered 3 lines)
        cursor.execute("SELECT is_active FROM users WHERE id = %s", (user_id,))
        ...
```

### models/database.py
# Relation: transitive reference
# Tier: 3 (original lines: 1-51)
```python
class UserDatabase:
    def __init__(self, ...): ...
    def create_user(self, ...): ...
    def get_user(self, ...): ...
```
```

---

## 8. Feature: Goal Synthesis Layer

### 8.1 Problem Statement

When a developer types `"fix bug"` as their query, the neural pruner has very little semantic signal to decide which lines are relevant. The Goal Synthesis layer transforms this vague input into a structured retrieval objective.

### 8.2 Structured Goal Schema (`goal_models.py`)

```python
class StructuredGoal(BaseModel):
    task_type: str           # "bug_fix", "refactor", "feature_addition", "test_generation"
    objective: str           # Precise description of the code target
    identifiers: List[str]   # Class/function/variable names
    observed_errors: List[str]  # Diagnostic error messages from VS Code
    required_context: List[str] # Modules that must be inspected
    retrieval_questions: List[str]  # Questions for codebase search
    clarification_required: bool    # True if query is too vague
```

### 8.3 Goal Compilation Pipeline (`goal_compiler.py`)

1. **Vagueness Detection**: If the query is in `{"fix bug", "fix", "bug", "help", "debug", "test", "run"}` AND there is no editor evidence (no selection, no diagnostics, no symbol under cursor), the goal is marked as `clarification_required: true`.

2. **Local LLM Query** (if available): Sends a structured prompt to the local LLM (Qwen2.5-Coder-1.5B-Instruct via Ollama at `http://127.0.0.1:11434/v1/chat/completions`) asking it to transform the query + editor evidence into a `StructuredGoal` JSON.

3. **Deterministic Fallback** (if LLM is unavailable): Uses keyword-based intent classification:

   | Query Keyword | Task Type | Objective Template |
   |--------------|-----------|-------------------|
   | `fix`, `debug` | bug_fix | "Identify error handling paths, exception blocks..." |
   | `optimize` | generic_task | "Locate performance-critical loops, redundant computations..." |
   | `add` | feature_addition | "Find insertion points, related interfaces..." |
   | `refactor` | refactor | "Locate tightly coupled modules, duplicated logic..." |
   | `test` | test_generation | "Find testable functions, edge cases..." |

4. **Post-Processing Validation**: Filters hallucinated identifiers by checking them against a vocabulary extracted from the query, selected code, diagnostics, and current symbol. Any identifier not present in this vocabulary is removed.

### 8.4 Local LLM Client (`goal_generator_client.py`)

Sends requests to an OpenAI-compatible endpoint (Ollama, LM Studio, or mock server):

```python
async with httpx.AsyncClient(timeout=15.0) as client:
    response = await client.post(
        f"{url}/chat/completions",
        json={
            "model": "qwen2.5-coder:1.5b-instruct-q4_k_m",
            "messages": [
                {"role": "system", "content": "You are a code context goal synthesis model..."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
    )
```

The `temperature: 0.0` ensures deterministic output. The `response_format: json_object` forces structured JSON output from the model.

---

## 9. Feature: Carbon Footprint Tracking

### 9.1 How It Works

Every time code is pruned, the extension:

1. Counts original tokens and pruned tokens using the GPT tokenizer
2. Estimates energy (Joules) for processing each token count
3. Converts Joules to CO₂ grams using the regional carbon intensity factor
4. Computes savings: `before.co2 - after.co2`
5. Accumulates session savings in the status bar

### 9.2 Session Carbon Display

The VS Code status bar updates in real-time:

```
Before pruning: $(filter) TokenWise
After pruning:  $(leaf) TokenWise 0.001234g saved
After 10 prunes: $(leaf) TokenWise 0.012345g saved
```

### 9.3 Estimation Modes

| Mode | Source | When Used |
|------|--------|-----------|
| **Remote** | Backend `/estimate-carbon` endpoint with trained XGBoost/Ridge models | Default; most accurate |
| **Local** | Built-in constant-based estimator in TypeScript | Fallback when backend is unreachable |

The local estimator uses lookup tables:
```typescript
const MODEL_CONSTANTS = {
    "gpt-4o": { prefillJoulesPerInputToken: 0.003, decodeJoulesPerOutputToken: 0.012 },
    "claude-3-5-sonnet": { prefillJoulesPerInputToken: 0.0028, decodeJoulesPerOutputToken: 0.0102 },
    "default": { prefillJoulesPerInputToken: 0.002, decodeJoulesPerOutputToken: 0.008 },
};
```

---

## 10. Data Flow: End-to-End Request Lifecycle

### Scenario: "Build Repository Context" Command

```
Developer clicks "TokenWise: Build Repository Context" on main.py
Developer types: "fix database connection port conflict"
                    │
                    ▼
┌──────────────── VS Code Extension ────────────────┐
│ 1. Collects editor evidence:                       │
│    - active_file: "main.py"                        │
│    - language: "python"                             │
│    - workspace_root: "E:\project"                   │
│    - current_symbol: "DatabaseConnection"           │
│    - diagnostics: ["Connection refused on port 5432"]│
│    - selected_code: (none)                          │
│ 2. Reads settings:                                  │
│    - local_llm_url: "http://127.0.0.1:11434/v1"   │
│    - local_llm_model: "qwen2.5-coder:1.5b"        │
│    - threshold: 0.45                                │
│ 3. Sends POST /prune-workspace                      │
└────────────────────┬──────────────────────────────┘
                     ▼
┌──────────── FastAPI Backend ──────────────────────┐
│ 4. GoalCompiler.compile():                         │
│    → Builds LLM prompt with editor evidence        │
│    → Queries local LLM (or uses fallback)          │
│    → Returns StructuredGoal:                        │
│      {task_type: "bug_fix",                         │
│       identifiers: ["database", "connection", ...], │
│       objective: "Identify error handling paths..."} │
│                                                     │
│ 5. RepositoryIndex.build_index():                   │
│    → Walks E:\project, parses all .py files          │
│    → Extracts classes, functions, imports, calls     │
│    → Result: {21 files indexed}                      │
│                                                     │
│ 6. DependencyGraph.build_graph():                   │
│    → Resolves import paths and symbol calls          │
│    → Builds bidirectional adjacency list             │
│                                                     │
│ 7. LexicalRetriever.search_identifiers():           │
│    → Finds files with "database", "connection"       │
│    → Seeds: {"main.py", "models/database.py"}        │
│                                                     │
│ 8. GraphRetriever.get_neighbors(seeds, max_hops=1): │
│    → BFS from seeds: adds utils/helpers.py, etc.     │
│    → Total ego-graph: 8 files                        │
│                                                     │
│ 9. CandidateRanker.rank_candidates():               │
│    → Scores main.py: -0.0018 (high relevance)       │
│    → Scores models/database.py: -4.2523             │
│    → Skips 6 files with no identifier match: -5.0    │
│                                                     │
│ 10. ContextBuilder.pack_context():                  │
│    → Tier 1 (main.py): Light prune → 360 tokens     │
│    → Tier 3 (database.py): Signatures → 30 tokens   │
│    → Tier 3 (helpers.py): Signatures → 18 tokens     │
│    → ... (18 more files as signatures)               │
│    → Total: 562 pruned tokens from 488 original      │
│                                                     │
│ 11. Returns WorkspacePruneResponse                   │
└────────────────────┬──────────────────────────────┘
                     ▼
┌──────────── VS Code Extension ────────────────────┐
│ 12. ResultPanel.showWorkspaceResult():              │
│    → Renders WebView with:                          │
│      - Synthesized Goal details                     │
│      - File table with tiers, scores, relations     │
│      - Full unified prompt (ready for LLM)          │
│    → Copy/Insert buttons                            │
└────────────────────────────────────────────────────┘
```

---

## 11. Configuration & Settings

All settings are configurable via VS Code `settings.json` under the `tokenWise` namespace:

| Setting | Default | Description |
|---------|---------|-------------|
| `tokenWise.apiUrl` | `http://127.0.0.1:8000` | Backend server URL |
| `tokenWise.localLlmUrl` | `http://127.0.0.1:11434/v1` | Local LLM endpoint (Ollama/LM Studio) |
| `tokenWise.localLlmModelName` | `qwen2.5-coder:1.5b-instruct-q4_k_m` | Local LLM model identifier |
| `tokenWise.timeoutMs` | `120000` | HTTP request timeout (ms) |
| `tokenWise.defaultThreshold` | `0.45` | Default pruning threshold (0-1) |
| `tokenWise.autoOpenResultPanel` | `true` | Auto-open WebView after pruning |
| `tokenWise.enableCarbonEstimation` | `true` | Enable CO₂ tracking |
| `tokenWise.carbonEstimatorMode` | `remote` | `"remote"` or `"local"` |
| `tokenWise.targetModelName` | `gpt-4o` | Target LLM for carbon estimation |
| `tokenWise.targetModelSizeB` | `200` | Target model size (billions) |
| `tokenWise.targetGpuType` | `nvidia-a100-80gb` | GPU assumption for estimation |
| `tokenWise.expectedOutputTokens` | `256` | Expected LLM output length |
| `tokenWise.latencyPerInputTokenMs` | `0.8` | Prefill latency per token |
| `tokenWise.latencyPerOutputTokenMs` | `2.2` | Decode latency per token |
| `tokenWise.carbonIntensityGPerKwh` | `475` | Regional carbon intensity (gCO₂/kWh) |

---

## 12. Research Foundations

### 12.1 SWE-Pruner (Core Model)

- **Paper**: SWE-Pruner — Task-Aware Code Context Compression
- **Contribution**: Treats code pruning as token-level sequence labeling with a CRF head, achieving state-of-the-art compression ratios while maintaining downstream task accuracy.
- **Our Extension**: We use the trained SWE-Pruner model as-is for single-file pruning and extend it with a scoring head for file-level reranking.

### 12.2 SEAL (Carbon Estimation)

- **Paper**: SEAL — Sustainability Evaluation and Assessment of LLMs
- **Contribution**: Decomposes LLM inference energy into prefill and decode phases, models energy as a function of hardware, model size, and token counts.
- **Our Extension**: We train XGBoost interpolation models and Ridge extrapolation models on SEAL benchmark data and deploy them as the `/estimate-carbon` endpoint.

### 12.3 Qwen3-Reranker (Backbone)

- **Model**: Qwen/Qwen3-Reranker-0.6B (HuggingFace)
- **Role**: Serves as the backbone for both token-level compression scoring and document-level relevance scoring.

### 12.4 Qwen2.5-Coder (Goal Synthesis)

- **Model**: Qwen/Qwen2.5-Coder-1.5B-Instruct (via Ollama)
- **Role**: Transforms vague developer queries into structured Goal JSON objects using instruction-following capabilities.

---

> **Summary**: TokenWise is a complete, publication-ready system that addresses three limitations of existing AI-assisted coding workflows: token waste, inference latency, and carbon emissions. It combines a trained neural pruner (SWE-Pruner + CRF + multi-layer fusion), repository-level context retrieval (AST indexing + dependency graphs + neural reranking), structured goal synthesis (local LLM + deterministic fallback), and prompt-level carbon estimation (SEAL-style dual-mode regressors) into a seamless VS Code extension experience.
