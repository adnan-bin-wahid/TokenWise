# Future Directions 2: Paper-Publication-Ready Enhancements for TokenWise

> **Purpose**: This document identifies every remaining gap, limitation, and improvement opportunity in the current TokenWise system. Each proposed enhancement is grounded in recent peer-reviewed research (2023–2026). Implementing these directions will transform TokenWise from a working prototype into a publication-ready, state-of-the-art system.

---

## Current State Assessment

Before proposing directions, let us audit what the current v2 implementation **has** and what it **lacks**:

### ✅ What We Have (Implemented in v2)

| Feature | Implementation |
|---------|---------------|
| Neural line-level pruning | Qwen3-Reranker-0.6B + CRF compression head |
| Single-file prune command | `/prune` endpoint with chunking support |
| Repository-level context retrieval | AST index + dependency graph + BFS + neural reranking |
| Goal synthesis with LLM | Local Qwen2.5-Coder via Ollama + deterministic fallback |
| Carbon estimation | SEAL-style XGBoost/Ridge dual-mode regressor |
| VS Code extension | Commands, WebView result panel, status bar CO₂ tracker |
| 3-tier context packaging | Tier 1 (light prune), Tier 2 (aggressive prune), Tier 3 (signatures) |

### ❌ What We Lack (Gaps to Fill)

| Gap | Severity | Publication Impact |
|-----|----------|-------------------|
| Python-only indexing (no TypeScript, Java, C++, etc.) | **Critical** | Limits generalizability claims |
| No formal evaluation benchmark | **Critical** | Cannot publish without quantitative results |
| Static pruning threshold (user must guess 0.45) | **High** | Sub-optimal pruning across file types |
| No knapsack-style token budget optimization | **High** | Wastes budget on low-value files |
| No incremental indexing (re-indexes entire workspace every time) | **High** | Unusable on large repositories |
| No empirical carbon validation | **High** | Cannot claim carbon savings without ground truth |
| No user study / developer evaluation | **High** | Missing human factors validation |
| No self-improving goal synthesis (no feedback loop) | **Medium** | Static quality, no online learning |
| No cross-language dependency tracking | **Medium** | Cannot handle polyglot repositories |
| No visualization of token scores (heatmap) | **Medium** | Missing interpretability for users |
| No comparison with LLMLingua, LongCodeZip, etc. | **Medium** | Reviewers will ask for baselines |
| No continuous latent compression alternative | **Low** | Missing comparison paradigm |

---

## Direction 1: Multi-Language Repository Indexing

### Gap Analysis

The current `PythonASTIndexer` (in `repository/python_indexer.py`) uses Python's built-in `ast` module, which parses only `.py` files. Real-world repositories contain TypeScript, JavaScript, Java, C++, Go, Rust, and more. This single-language limitation:

1. **Blocks generalizability claims** in any paper submission
2. **Prevents usage** by the vast majority of VS Code users
3. **Misses cross-language dependencies** (e.g., Python calling a C extension, TypeScript importing a `.wasm` module)

### Research Basis

#### Paper: Reliable Graph-RAG for Codebases (2025/2026)

This paper demonstrates that **deterministic AST-derived knowledge graphs** built via Tree-sitter significantly outperform LLM-extracted knowledge graphs for code retrieval. Tree-sitter provides incremental, error-tolerant parsing across 100+ languages with a unified API.

#### Paper: Code-Aware Structural Chunking (CAST) — CMU, 2025

CAST proves that syntactically-aligned chunking (splitting at function/class boundaries rather than arbitrary character counts) preserves semantic structure critical for high-quality retrieval. Tree-sitter's node hierarchy directly enables this.

### Proposed Implementation

```
repository/
├── python_indexer.py    # Existing (keep as reference)
├── tree_sitter_indexer.py  # NEW: Universal indexer using Tree-sitter
├── language_registry.py    # NEW: Maps file extensions → grammar + query patterns
└── dependency_graph.py     # MODIFY: Accept cross-language edges
```

**Phase 1: Tree-sitter Integration**
- Install `tree-sitter` Python bindings and language grammars for: Python, TypeScript, JavaScript, Java, Go, Rust, C/C++
- Write Tree-sitter S-expression queries for each language to extract: classes, functions/methods, imports, calls
- Replace `PythonASTIndexer` with a unified `TreeSitterIndexer` that dispatches to the correct grammar based on file extension

**Phase 2: Cross-Language Dependency Resolution**
- Parse `import` statements across languages (Python `from X import Y`, TypeScript `import { Y } from './X'`, Java `import com.X.Y`)
- Build cross-language edges in the dependency graph when a Python file imports a module that has a corresponding `.ts` or `.java` file

**Phase 3: Language-Specific Pruning Heuristics**
- Java/C++: Always preserve class declarations and `public` method signatures in Tier 3
- TypeScript: Preserve `interface` and `type` declarations as they define API contracts
- Go: Preserve exported symbols (capitalized function names) in Tier 3

### Publication Value

> *"TokenWise supports 8 programming languages via Tree-sitter-based incremental parsing, enabling cross-language dependency graph construction."* — This claim alone differentiates from SWE-Pruner (Python-only) and LongCodeZip (language-agnostic but structure-unaware).

---

## Direction 2: Knapsack-Optimized Token Budget Allocation

### Gap Analysis

The current `ContextBuilder.pack_context()` processes ALL indexed files in the workspace and includes every file that appears in the ego-graph, regardless of the total token count. There is no global token budget constraint. This means:

1. For large repositories, the unified prompt can exceed any LLM's context window
2. Low-relevance Tier 3 files consume tokens that could be given to high-relevance Tier 1 files
3. The allocation is static (Tier 1 always gets `threshold - 0.15`, Tier 2 gets `threshold + 0.15`) rather than adapting to the available budget

### Research Basis

#### Paper: LongCodeZip — ASE 2025

LongCodeZip introduces a **0/1 knapsack formulation** for code context budget allocation:
- Each candidate block has a **cost** (its token count) and a **value** (its relevance score from conditional perplexity / AMI)
- The **capacity** is the target LLM's context window minus the query/instruction overhead
- Solving the knapsack selects the optimal subset of blocks that maximizes total relevance under the budget

This achieves **5.6× compression** without degrading task performance — far superior to uniform thresholding.

#### Paper: HCP — Hierarchical Context Pruning (AAAI 2025)

HCP demonstrates that **topology-aware pruning** (considering import chains, call depths) yields better code completion accuracy than flat relevance ranking. Files deeper in the dependency chain should receive less budget, not equal budget.

### Proposed Implementation

#### Step 1: Define Token Budget

```python
class ContextBuilder:
    def __init__(self, token_budget: int = 8192):  # Existing
        self.token_budget = token_budget
```

The budget should be configurable via `tokenWise.contextTokenBudget` setting, defaulting to the target LLM's context window (e.g., 8192 for GPT-4o-mini, 128K for GPT-4o).

#### Step 2: Value Function per File

For each candidate file, compute a **composite value score**:

```python
value(file) = α × rerank_score(file) + β × (1 / (distance(file) + 1)) + γ × identifier_overlap(file, goal)
```

Where:
- `rerank_score`: Neural relevance score from CandidateRanker (-∞ to +∞)
- `distance`: Graph distance from seed files (0, 1, 2, ...)
- `identifier_overlap`: Fraction of goal identifiers found in this file
- `α, β, γ` are learned or manually tuned weights

#### Step 3: 0/1 Knapsack Solver

```python
def knapsack_allocate(files: List[FileCandidate], budget: int) -> List[FileCandidate]:
    """
    Dynamic programming knapsack to select files maximizing total value
    within the token budget.
    """
    n = len(files)
    # DP table: dp[i][w] = max value using first i files with budget w
    dp = [[0.0] * (budget + 1) for _ in range(n + 1)]
    
    for i in range(1, n + 1):
        cost = files[i-1].estimated_pruned_tokens
        val = files[i-1].value_score
        for w in range(budget + 1):
            dp[i][w] = dp[i-1][w]
            if cost <= w:
                dp[i][w] = max(dp[i][w], dp[i-1][w - cost] + val)
    
    # Backtrack to find selected files
    selected = []
    w = budget
    for i in range(n, 0, -1):
        if dp[i][w] != dp[i-1][w]:
            selected.append(files[i-1])
            w -= files[i-1].estimated_pruned_tokens
    
    return selected
```

#### Step 4: Adaptive Threshold per File

Instead of fixed thresholds (Tier 1: `threshold - 0.15`, Tier 2: `threshold + 0.15`), compute per-file thresholds based on their budget allocation:

```python
# If a file was allocated 200 tokens but has 500, use a higher threshold
# If a file was allocated 400 tokens but has 500, use a lower threshold
allocated_ratio = allocated_budget / original_tokens
adjusted_threshold = base_threshold + (1 - allocated_ratio) * 0.3
```

### Publication Value

> *"TokenWise formulates cross-file context assembly as a 0/1 knapsack optimization, achieving X% higher downstream task accuracy compared to uniform thresholding under equivalent token budgets."*

---

## Direction 3: Adaptive Pruning Threshold via Reward-Based Learning

### Gap Analysis

The current system uses a **static, user-specified threshold** (default: 0.45). This is suboptimal because:

1. Different files have different score distributions — a threshold of 0.45 might prune 80% of a utility file but only 20% of the active file
2. Different tasks have different precision/recall requirements — debugging needs high recall (keep more), optimization needs high precision (keep less)
3. Users cannot know the right threshold without trial-and-error

### Research Basis

#### Paper: RaFe — Ranking Feedback Improves Query Rewriting (EMNLP Findings, 2024)

RaFe demonstrates that an existing reranker's relevance score can serve as a **reward signal** to fine-tune a query rewriter without human labels. The key insight: the same scoring model can provide training signal for upstream components.

**Alignment**: Our Qwen3-Reranker already produces `score_logits`. This score can be used as reward to train an **adaptive threshold predictor** — a small network that predicts the optimal threshold for each (query, file) pair.

#### Paper: XiNet — Adaptive Pruning via Stochastic Optimization (NeurIPS 2025)

XiNet shows that simultaneous training of weights and sparsity parameters (via differentiable Bernoulli masks) outperforms post-hoc pruning. The threshold is not a hyperparameter but a learned parameter.

### Proposed Implementation

#### Phase 1: Heuristic Adaptive Threshold (No Training Required)

Implement a score-distribution-based threshold:

```python
def compute_adaptive_threshold(line_scores: Dict[int, float], target_retention: float = 0.6) -> float:
    """
    Compute threshold that retains approximately `target_retention` fraction of scored lines.
    """
    scores = sorted(line_scores.values())
    if not scores:
        return 0.5
    # Find the score at the (1 - target_retention) percentile
    idx = int(len(scores) * (1 - target_retention))
    return scores[idx]
```

This adapts to each file's score distribution rather than using a fixed global value.

#### Phase 2: Task-Aware Retention Targets

Map task types from the `StructuredGoal` to retention targets:

```python
TASK_RETENTION_TARGETS = {
    "bug_fix": 0.70,          # Keep more context for debugging
    "refactor": 0.50,         # Keep less — focus on structure
    "feature_addition": 0.55, # Moderate retention
    "test_generation": 0.60,  # Need existing patterns
    "generic_task": 0.60,     # Default
}
```

#### Phase 3: Learned Threshold Predictor (Requires Training Data)

Train a small MLP that predicts the optimal threshold given:
- Mean and variance of token scores in the file
- Task type (one-hot encoded)
- File size (log-scaled)
- Document-level relevance score

The training signal comes from evaluating downstream LLM accuracy at different thresholds on a held-out set.

### Publication Value

> *"TokenWise introduces task-type-conditioned adaptive thresholding that adjusts pruning aggressiveness based on the synthesized goal type, achieving Y% better precision-recall balance compared to fixed thresholds."*

---

## Direction 4: Formal Evaluation on SWE-Bench and LongCodeQA

### Gap Analysis

This is the **single most critical gap** for paper publication. Without quantitative evaluation on established benchmarks, no venue will accept the paper. The current system has been tested manually but has no automated evaluation pipeline.

### Research Basis

#### Benchmark: SWE-Bench Verified (2024)

300 curated GitHub issue instances with gold patches. The standard benchmark for evaluating code repair agents. SWE-Pruner itself was evaluated on this benchmark.

#### Benchmark: SWE-ContextBench (2026)

1,136 tasks across 66 repositories with gold contexts annotated at file, block, and line granularity. Specifically designed to evaluate context retrieval quality.

#### Benchmark: LongCodeQA (2025)

Long-context code question answering benchmark. Tests whether compressed context retains sufficient information for answering code-related questions.

#### Benchmark: REPOEXEC (2024, ACL Findings)

Function-level code generation with executability verification. Tests whether generated code correctly calls cross-file dependencies.

### Proposed Evaluation Pipeline

#### Experiment 1: Context Retrieval Quality (SWE-ContextBench)

```
For each task in SWE-ContextBench:
    1. Run TokenWise repository-level pruning with the issue description as query
    2. Compare retrieved files against gold file set
    3. Compare pruned lines against gold line set
    
Metrics:
    - File-level Recall@K: % of gold files retrieved in top K
    - Line-level F1: Precision × Recall of kept lines vs gold lines
    - Token Reduction Ratio: (original - pruned) / original
    - Context Utilization Rate: % of retrieved context actually used by downstream LLM
```

#### Experiment 2: Downstream Task Performance (SWE-Bench Verified)

```
For each issue in SWE-Bench Verified:
    1. Run TokenWise to produce pruned context
    2. Feed pruned context to a coding agent (OpenHands/Aider/Claude)
    3. Check if the agent's patch passes the issue's test suite
    
Metrics:
    - Pass@1: % of issues resolved with pruned context
    - Token Cost: Average tokens sent to the LLM
    - Cost Efficiency: Pass@1 / Token Cost (higher is better)
    
Baselines:
    - Full context (no pruning)
    - BM25 retrieval (traditional IR baseline)
    - LongCodeZip (conditional perplexity + knapsack)
    - LLMLingua-2 (general-purpose prompt compression)
    - SWE-Pruner (original, single-file only)
```

#### Experiment 3: Carbon Savings Validation

```
For each benchmark run:
    1. Measure actual GPU energy consumption using CodeCarbon
    2. Compare actual energy with TokenWise's predicted energy
    3. Report correlation (R²) and mean absolute error
    
Metrics:
    - Prediction Accuracy: R² of predicted vs actual joules
    - Actual CO₂ Saved: Sum of (full_context_energy - pruned_context_energy) × carbon_intensity
    - Carbon-Accuracy Pareto: Plot CO₂ saved vs Pass@1
```

#### Experiment 4: Ablation Study

```
Ablate each component and measure impact on Pass@1:
    - No goal synthesis (raw query only)
    - No dependency graph (lexical retrieval only)
    - No neural reranking (random ordering)
    - No CRF head (FFN head only)
    - No multi-layer fusion (last layer only)
    - No 3-tier packaging (uniform pruning for all files)
```

### Implementation Steps

1. **Create `evaluation/` directory** with scripts for each experiment
2. **Download SWE-Bench Verified** dataset (publicly available)
3. **Build evaluation harness** that runs TokenWise end-to-end and measures metrics
4. **Run experiments on GPU server** (SWE-Bench evaluation requires running test suites in Docker)
5. **Generate LaTeX tables and plots** for the paper

### Publication Value

> This is non-negotiable. Without these experiments, the paper cannot be submitted to any top venue (ICSE, FSE, ASE, EMNLP, NeurIPS).

---

## Direction 5: Incremental Repository Indexing

### Gap Analysis

The current `RepositoryIndex.build_index()` walks the entire workspace and re-parses every file on every `/prune-workspace` request. For a 500-file repository, this adds 2–5 seconds of latency per request and makes the system unusable for repositories with >1000 files.

### Research Basis

#### Tree-sitter Incremental Parsing (Brunsfeld, 2018 — ongoing)

Tree-sitter natively supports incremental parsing — given a previous parse tree and a set of character edits, it re-parses only the affected regions. This is how VS Code's built-in syntax highlighting works.

#### Paper: Incremental Knowledge Graph Construction for Code (2025)

Recent work on code knowledge graphs demonstrates that combining incremental AST diffs with Merkle-tree-based change detection reduces re-indexing time by 95% on average.

### Proposed Implementation

```python
class IncrementalRepositoryIndex:
    def __init__(self, workspace_root: str):
        self.workspace_root = Path(workspace_root)
        self.index: Dict[str, Any] = {}
        self.file_hashes: Dict[str, str] = {}  # path → content hash
    
    def update_index(self):
        """Only re-index files that have changed since last indexing."""
        for file_path in self.walk_files():
            content = file_path.read_text()
            content_hash = hashlib.md5(content.encode()).hexdigest()
            
            rel_path = str(file_path.relative_to(self.workspace_root))
            if rel_path in self.file_hashes and self.file_hashes[rel_path] == content_hash:
                continue  # File unchanged, skip
            
            # Re-index only this file
            self.index[rel_path] = self.indexer.index_file(file_path)
            self.file_hashes[rel_path] = content_hash
        
        # Remove deleted files
        for rel_path in list(self.index.keys()):
            if not (self.workspace_root / rel_path).exists():
                del self.index[rel_path]
                del self.file_hashes[rel_path]
```

Additionally, persist the index to disk between requests:
```python
def save_index(self, cache_path: Path):
    cache_path.write_text(json.dumps({
        "index": self.index,
        "hashes": self.file_hashes
    }))

def load_index(self, cache_path: Path):
    if cache_path.exists():
        data = json.loads(cache_path.read_text())
        self.index = data["index"]
        self.file_hashes = data["hashes"]
```

### Publication Value

> *"TokenWise achieves sub-second re-indexing on repositories with >1000 files through content-hash-based incremental indexing, compared to X seconds for full re-indexing."*

---

## Direction 6: Self-Improving Goal Synthesis via Reranker Feedback

### Gap Analysis

The current goal synthesis layer has two modes: local LLM (when Ollama is running) and deterministic fallback (keyword templates). Neither improves over time. The deterministic fallback is particularly weak — it cannot understand complex queries like "refactor the payment processing pipeline to support async transactions".

### Research Basis

#### Paper: RaFe — Ranking Feedback Improves Query Rewriting (EMNLP Findings, 2024)

RaFe trains a query rewriter using the downstream reranker's relevance score as a reward signal, **without any human-labeled data**. The loop is:

```
query → rewriter → expanded_query → reranker → score
                                                  ↓
                                            reward signal
                                                  ↓
                                     update rewriter parameters
```

#### Paper: QA-Expand — Multi-Question Answer Generation (arXiv:2502.08557, Feb 2025)

QA-Expand shows that generating **multiple retrieval sub-questions** from a single query and filtering them via a feedback model produces significantly richer retrieval signals than single-pass expansion.

### Proposed Implementation

#### Phase 1: Logging for Future Training

Add instrumented logging to capture (query, goal, reranker_scores) tuples:

```python
# In online_serving.py, after workspace prune completes:
training_sample = {
    "query": request.query,
    "goal": goal.dict(),
    "file_scores": [(f["file_path"], f["score"]) for f in file_summaries],
    "total_reduction_pct": (original_tokens - pruned_tokens) / original_tokens,
    "timestamp": datetime.utcnow().isoformat()
}
logger.info(f"TRAINING_SAMPLE: {json.dumps(training_sample)}")
```

#### Phase 2: Offline Goal Quality Metric

Define a quality metric for the synthesized goal:

```
GoalQuality(goal, scores) = mean(top_k_scores) - mean(bottom_k_scores)
```

A good goal separates relevant files (high scores) from irrelevant files (low scores). A bad goal produces uniform scores.

#### Phase 3: Fine-Tune Goal Generator

Using collected (query, editor_evidence, goal, quality_score) pairs:
1. Filter samples where `quality_score > median` as positive examples
2. Use DPO (Direct Preference Optimization) or RLHF to fine-tune Qwen2.5-Coder
3. Deploy the improved model as the new goal synthesizer

### Publication Value

> *"TokenWise implements a self-improving goal synthesis loop where the existing neural reranker provides reward signals for updating the goal generator, eliminating the need for human-labeled training data (RaFe, EMNLP 2024)."*

---

## Direction 7: Visualization and Interpretability

### Gap Analysis

The current ResultPanel shows the pruned code as plain text. There is no visualization of **why** specific lines were kept or pruned. This limits:

1. **User trust** — developers cannot verify the pruning is correct
2. **Debugging** — when pruning is wrong, there's no way to diagnose why
3. **Paper presentation** — reviewers expect visual examples of the system in action

### Proposed Implementation

#### Feature 7A: Token-Level Heatmap

Color-code each token in the WebView based on its relevance score:

```html
<span style="background-color: rgba(76, 175, 80, 0.6);">def</span>
<span style="background-color: rgba(76, 175, 80, 0.8);">login</span>
<span style="background-color: rgba(76, 175, 80, 0.3);">(</span>
<span style="background-color: rgba(76, 175, 80, 0.7);">user</span>
<span style="background-color: rgba(244, 67, 54, 0.2);">,</span>
<span style="background-color: rgba(244, 67, 54, 0.4);">password</span>
<span style="background-color: rgba(244, 67, 54, 0.1);">)</span>
```

Green = high relevance score, Red = low relevance score. The `token_scores` field already exists in `PruneResponse` — it just needs to be rendered.

#### Feature 7B: Dependency Graph Visualization

Render the ego-graph in the workspace result panel using a lightweight JavaScript graph library (e.g., D3.js force-directed layout or Mermaid):

```
[main.py] ──imports──→ [models/database.py]
    │                         │
    └──calls──→ [utils/helpers.py]
                              │
              [tests/test_main.py] ──tests──→ [main.py]
```

Nodes colored by tier: Green (Tier 1), Yellow (Tier 2), Gray (Tier 3).

#### Feature 7C: Pruning Decision Explanation

For each pruned block, add a tooltip explaining **why** it was pruned:

```
(filtered 5 lines)  ← "Lines 23-27: avg score 0.12 < threshold 0.45. 
                        Content: logging configuration unrelated to query 'fix auth bug'"
```

### Publication Value

> Interpretability visualizations are increasingly required by top SE/ML venues. Figures showing heatmaps on real code examples make the paper significantly more compelling.

---

## Direction 8: Comparison with State-of-the-Art Baselines

### Gap Analysis

No paper will be accepted without comparison against existing methods. The following baselines must be implemented or integrated:

### Required Baselines

| Baseline | Type | Availability |
|----------|------|-------------|
| **No Compression** | Control | Trivial (send full context) |
| **BM25 Retrieval** | Lexical | `rank-bm25` Python package |
| **LLMLingua-2** | Prompt compression | Open-source (Microsoft) |
| **LongCodeZip** | Code-specific compression | Open-source (GitHub) |
| **SWE-Pruner (original)** | Single-file pruning | Our own model without v2 extensions |
| **Random Sampling** | Random | Select random lines to fill budget |
| **First-K Truncation** | Naive | Keep first K tokens, truncate rest |

### Implementation Plan

1. Create `evaluation/baselines/` directory
2. Implement adapter classes for each baseline that accept `(query, code, budget)` and return compressed text
3. Run all baselines on the same benchmark splits
4. Report results in a single comparison table

### Publication Value

> Without these baselines, reviewers will reject the paper. With them, the narrative becomes: *"TokenWise outperforms LLMLingua-2 by X% on file-level F1 and LongCodeZip by Y% on downstream Pass@1, while also providing carbon estimation — a capability no existing system offers."*

---

## Direction 9: LLMCarbon-Enhanced Carbon Estimation

### Gap Analysis

The current carbon estimator uses trained regressors on a relatively small benchmark dataset. Recent research (LLMCarbon, 2024/2025) provides much more sophisticated lifecycle-aware estimation.

### Research Basis

#### Paper: LLMCarbon — End-to-End Carbon Projection for LLMs (Indiana University, 2024/2025)

LLMCarbon accounts for:
- **Training carbon** (amortized over model lifetime)
- **Inference carbon** (operational energy per request)
- **Embodied carbon** (hardware manufacturing emissions, 24–35% of total)
- **MoE architectures** (sparse activation reduces per-token energy)

#### Paper: CodeCarbon — Real-Time Emission Tracking (2024)

CodeCarbon provides ground-truth energy measurements via hardware power sensors (RAPL for Intel, NVML for NVIDIA). This can validate our regressor predictions.

### Proposed Enhancements

#### Enhancement 9A: Embodied Carbon Amortization

Add a term for amortized manufacturing emissions:

```python
embodied_co2 = hardware_embodied_kg / (expected_lifetime_hours * 3600)  # kg/s
request_duration_s = (prefill_latency + decode_latency) / 1000
embodied_per_request = embodied_co2 * request_duration_s * 1000  # grams
```

#### Enhancement 9B: MoE-Aware Estimation

For Mixture-of-Experts models (GPT-4, Mixtral), only a fraction of parameters are active per token:

```python
if model_is_moe:
    effective_size = model_size_b * (active_experts / total_experts)
else:
    effective_size = model_size_b
```

#### Enhancement 9C: Real-Time Carbon Intensity via API

Instead of using a static `475 gCO₂/kWh`, query a real-time carbon intensity API:

```python
# https://api.electricitymap.org or https://api.co2signal.com
async def get_realtime_carbon_intensity(region: str) -> float:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.co2signal.com/v1/latest?countryCode={region}")
        return resp.json()["data"]["carbonIntensity"]
```

This enables **carbon-aware scheduling** — deferring non-urgent LLM calls to times when the grid is cleaner.

### Publication Value

> *"TokenWise extends SEAL-style estimation with embodied carbon amortization, MoE-aware effective parameter sizing, and real-time grid carbon intensity, providing the most comprehensive prompt-level carbon accounting in the literature."*

---

## Direction 10: Continuous Latent Context Compression (Advanced Research Direction)

### Gap Analysis

TokenWise currently uses **discrete token pruning** — removing tokens from the sequence. An alternative paradigm is **continuous latent compression**, where the entire context is compressed into a fixed-size set of learned embedding vectors.

### Research Basis

#### Paper: AutoCompressor — Compressing Context via Summary Vectors (EMNLP 2023, widely cited through 2025)

AutoCompressor recursively compresses long contexts into "summary vectors" — continuous embeddings that the LLM reads as soft prompts. This achieves much higher compression ratios (30:1) than discrete pruning (5:1) but requires the target LLM to be fine-tuned to understand summary vectors.

#### Paper: Empirical Study on Context Compression Paradigms (arXiv, 2026)

This comprehensive survey categorizes compression into three paradigms:
1. **Discrete token sequences** (LLMLingua, SWE-Pruner, TokenWise) — Remove tokens
2. **Continuous latent vectors** (AutoCompressor, ICAE, Gist) — Compress to embeddings
3. **Visual tokens** (Screenshot compression) — Render code as images

The survey finds that latent vectors can **outperform full context** in some tasks by filtering noise, but require model-specific training.

### Proposed Hybrid Approach

Instead of replacing discrete pruning, offer latent compression as a **complementary option**:

```
┌─────────────────────────────────────────────────────┐
│  User selects compression mode:                      │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │ Discrete     │  │ Latent (requires compatible  │  │
│  │ (Default)    │  │ target LLM fine-tuning)      │  │
│  └─────────────┘  └──────────────────────────────┘  │
│                                                      │
│  Discrete: Token pruning → pruned text prompt        │
│  Latent:   Encoder → N summary vectors → soft prompt │
└─────────────────────────────────────────────────────┘
```

### Publication Value

> *"We compare discrete token pruning against continuous latent compression on the same benchmarks, finding that discrete pruning is more portable (works with any LLM) while latent compression achieves higher compression ratios when the target LLM is co-trained."*

---

## Direction 11: User Study and Developer Evaluation

### Gap Analysis

No user evaluation data exists. For publication at a top SE venue (ICSE, FSE, ASE), a user study is typically expected.

### Proposed Study Design

#### Study 1: Controlled Developer Experiment (N=12-20)

**Design**: Within-subjects study where participants complete coding tasks with and without TokenWise.

**Tasks**:
1. Bug fix: Given a failing test and repository, find and fix the bug
2. Feature addition: Add a new API endpoint to an existing service
3. Code review: Identify issues in a pull request

**Conditions**:
- **Control**: Full context (copy-paste entire relevant files into LLM)
- **TokenWise**: Use TokenWise to prune context before sending to LLM

**Metrics**:
| Metric | How Measured |
|--------|-------------|
| Task completion time | Wall clock |
| Task accuracy | Automated test suite |
| Token usage | Count tokens sent to LLM |
| Subjective satisfaction | Likert scale survey |
| Trust in pruning | Post-task interview |

#### Study 2: A/B Deployment Study (N=50-100)

Deploy TokenWise as a VS Code Marketplace extension and instrument it with opt-in telemetry:

**Metrics**:
- Weekly active users
- Commands used per session
- Median token reduction achieved
- Repeat usage rate (user returns after 1 week)
- "Copy" vs "Insert" action ratio

### Publication Value

> *"In a controlled study with N developers, TokenWise reduced median token usage by X% while maintaining equivalent task completion rates, with 85% of participants preferring pruned context over full context."*

---

## Direction 12: Integration with Coding Agent Frameworks

### Gap Analysis

TokenWise currently operates as a standalone VS Code extension. To maximize impact, it should integrate with existing coding agent frameworks.

### Proposed Integrations

#### Integration 12A: OpenHands Plugin

OpenHands (formerly OpenDevin) is an open-source coding agent framework. Adding a TokenWise pruning step to its context management pipeline would provide immediate SWE-Bench evaluation capabilities.

#### Integration 12B: Aider Integration

Aider is a CLI-based coding assistant. Adding a `--prune-context` flag that invokes TokenWise before sending context to the LLM would demonstrate value in non-IDE environments.

#### Integration 12C: Model Context Protocol (MCP) Server

Implement TokenWise as an MCP server with standardized tools:

```json
{
    "tools": [
        {"name": "prune_code", "description": "Prune code context for a task query"},
        {"name": "build_repository_context", "description": "Build pruned cross-file context"},
        {"name": "estimate_carbon", "description": "Estimate carbon footprint of LLM inference"}
    ]
}
```

This makes TokenWise accessible to any MCP-compatible AI assistant (Claude, Gemini, etc.).

### Publication Value

> *"TokenWise is available as an MCP server, VS Code extension, and Python library, enabling integration into heterogeneous AI-assisted development workflows."*

---

## Direction 13: Enhanced CRF Head with Structural Constraints

### Gap Analysis

The current CRF head treats all token transitions equally. It does not encode **structural knowledge** about code:

- An `import` statement should almost never be pruned if any symbol from that module is referenced later
- A `try:` line should never be pruned without its corresponding `except:` block
- A function signature should never be pruned if the function body is kept

### Research Basis

#### Paper: Constrained CRF for Structured Prediction (NeurIPS 2024)

Recent work on constrained CRFs demonstrates that adding hard or soft structural constraints to the transition matrix improves sequence labeling in domains with known structure (e.g., NER with entity type constraints).

### Proposed Implementation

Add structural constraint penalties to the CRF transition matrix:

```python
class StructureAwareCRFLayer(CRFLayer):
    def __init__(self, num_tags: int = 2):
        super().__init__(num_tags)
        # Penalty for pruning structural tokens
        self.structural_bonus = nn.Parameter(torch.tensor(0.5))
    
    def apply_structural_constraints(self, emissions: torch.Tensor, structural_mask: torch.Tensor):
        """
        structural_mask[b, i] = 1 if token i is structurally important
        (import, try/except, function def, class def, return)
        """
        # Boost "keep" emission for structural tokens
        emissions[:, :, 1] += self.structural_bonus * structural_mask
        return emissions
```

The `structural_mask` is computed by the AST indexer: mark tokens that fall within import statements, function/class definitions, try/except boundaries, and return statements.

### Publication Value

> *"By incorporating AST-derived structural constraints into the CRF transition model, TokenWise preserves syntactically critical constructs (imports, exception handlers, signatures) that task-agnostic pruning would remove."*

---

## Prioritized Implementation Roadmap

Based on publication impact and implementation effort:

### Phase 1: Evaluation Foundation (Weeks 1-3) — **CRITICAL**

| # | Direction | Effort | Impact |
|---|-----------|--------|--------|
| 4 | Formal Evaluation on SWE-Bench | High | **Maximum** — cannot publish without this |
| 8 | Baseline Comparisons | Medium | **Maximum** — required for any paper |

### Phase 2: Core Technical Contributions (Weeks 4-8) — **HIGH**

| # | Direction | Effort | Impact |
|---|-----------|--------|--------|
| 2 | Knapsack Token Budget Optimization | Medium | High — novel contribution |
| 3 | Adaptive Pruning Threshold | Medium | High — addresses key limitation |
| 5 | Incremental Repository Indexing | Medium | High — enables scalability |
| 7 | Visualization and Interpretability | Low | Medium — helps paper presentation |

### Phase 3: Extended Contributions (Weeks 9-14) — **MEDIUM**

| # | Direction | Effort | Impact |
|---|-----------|--------|--------|
| 1 | Multi-Language Indexing (Tree-sitter) | High | High — enables generalizability |
| 6 | Self-Improving Goal Synthesis | High | Medium — long-term research direction |
| 9 | LLMCarbon-Enhanced Estimation | Medium | Medium — stronger carbon story |
| 13 | Structural CRF Constraints | Medium | Medium — model improvement |

### Phase 4: Validation and Outreach (Weeks 15-18) — **HIGH**

| # | Direction | Effort | Impact |
|---|-----------|--------|--------|
| 11 | User Study | High | **Maximum** for SE venues |
| 12 | Agent Framework Integration | Medium | Medium — demonstrates versatility |
| 10 | Continuous Latent Compression | High | Low — alternative research direction |

---

## Target Publication Venues

Based on the contributions proposed above, the most appropriate venues are:

| Venue | Tier | Best Fit For |
|-------|------|-------------|
| **ICSE 2026** (SE) | A* | Full system paper: pruning + retrieval + carbon + user study |
| **FSE/ESEC 2026** (SE) | A* | Tool paper: VS Code extension + evaluation |
| **ASE 2026** (SE) | A | Technical contribution: knapsack + adaptive threshold + CRF |
| **EMNLP 2026** (NLP) | A* | Model paper: goal synthesis + reranker feedback + CRF constraints |
| **NeurIPS 2026 Datasets & Benchmarks** | A* | Benchmark paper: evaluation framework + baselines |
| **ICLR 2027** (ML) | A* | If latent compression comparison is strong |
| **Green Software Foundation** | Industry | Carbon estimation + sustainability angle |

---

## Summary

The current TokenWise v2 is a strong working prototype. To reach publication quality, the **highest priority** items are:

1. **Build an automated evaluation pipeline** (Direction 4) — no paper without numbers
2. **Implement baseline comparisons** (Direction 8) — no paper without baselines
3. **Add knapsack budget optimization** (Direction 2) — the strongest novel technical contribution
4. **Adaptive thresholding** (Direction 3) — addresses the most visible UX limitation
5. **Multi-language support** (Direction 1) — necessary for generalizability claims

Every other direction strengthens the paper but is not blocking. The core narrative is:

> *"TokenWise is the first system to combine task-aware neural code pruning with repository-level context retrieval and prompt-level carbon estimation, achieving state-of-the-art compression ratios on SWE-Bench while reducing LLM inference carbon emissions by X%."*
