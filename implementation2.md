# Implementation Plan: Evidence-Aware Goal Synthesis and Repository-Level Pruning for TokenWise

> **Purpose**: This document defines the research-grounded implementation plan for solving two critical limitations in the TokenWise/SWE-Pruner system — static goal hints and single-file context — as a unified, connected pipeline. It cites peer-reviewed papers (2023–2025) at every design decision and explains exactly how those papers justify each architectural choice.

---

## 0. Motivation and Problem Framing

The current TokenWise system is built on the SWE-Pruner paper (arXiv:2601.16746, Jan 2025), which proves that **task-aware, goal-directed line-level pruning** dramatically outperforms generic compression: 23–54% token reduction on SWE-Bench Verified and up to 14.84× compression on LongCodeQA, while maintaining or improving agent success rates.

However, two design assumptions from the original paper break down in the interactive developer IDE context:

**Limitation 1 — Goal Hints are static.** In the original agentic pipeline, the goal hint is generated automatically by the orchestrating agent (e.g., OpenHands, Claude Agent SDK) from structured agent state. When a developer uses TokenWise directly, they type a short, vague query like `"fix bug"`. The neural skimmer was trained on structured goal descriptions, not terse user queries. Feeding it a raw vague query degrades skimming precision significantly.

**Limitation 2 — Context is single-file.** Real software engineering tasks span multiple interdependent files. A bug in `auth/service.py` cannot be diagnosed without understanding its callers in `controllers/login.py` and its test coverage in `tests/test_auth.py`. The current architecture sends only the active file to the pruner. This is fundamentally insufficient for repository-level coding tasks.

Both limitations must be solved **together** as a single connected pipeline, not as two separate patches. The unified pipeline is:

```
Editor Evidence (diagnostics, active symbol, selected code)
   +
Raw User Query
       │
       ▼
[Goal Synthesis Layer]
   Structured Goal JSON
       │
       ▼
[Repository Retrieval Layer]
   Ranked Candidate Files and Symbols
       │
       ▼
[SWE-Pruner Reranking and Line-Level Pruning]
   Per-Symbol Pruned Code Blocks
       │
       ▼
[Token-Budget Packer]
   Unified Cross-File Context (for LLM consumption)
```

---

## 1. Limitation 1 — Evidence-Aware Goal Synthesis

### 1.1 The Core Problem

The SWE-Pruner paper defines a **Goal Hint** as an explicit, structured statement specifying the edit intent, affected modules, and expected behavior. The paper uses goal hints produced by the coding agent itself (which has rich structured state), so it never faces the problem of vague user input.

When TokenWise is used interactively, the developer's raw query replaces this structured hint. The neural skimmer interprets the query through the prompt template:

```
<Instruct>: Given a web search query, retrieve relevant passages…
<Query>: {raw_query}
<Document>: {code}
```

A raw query like `"fix bug"` is not semantically aligned with the training distribution of structured goal hints. The token distance between `"fix bug"` and the relevant code tokens explodes, producing low-precision line scores and degraded pruning quality.

### 1.2 Research Basis for the Proposed Solution

#### Paper 1 — Query2Doc: Query Expansion with Large Language Models (arXiv:2303.07678, EMNLP 2023)

Query2Doc establishes the core principle: use few-shot prompting to generate a richer pseudo-document from the user's short query, then concatenate the original query with the generated text to form a richer retrieval vector. This approach yields +3–15% nDCG@10 on MS-MARCO and TREC DL.

**Alignment with our problem**: Rather than expanding the query into a retrieval document, we expand it into a structured **Goal JSON** object. The LLM receives the short query plus editor evidence (diagnostics, current symbol, selected code), and generates a structured description that specifies the edit type, target identifiers, and retrieval sub-questions. This is functionally identical to Query2Doc's pseudo-document generation but adapted to a structured output schema.

#### Paper 2 — SWE-Pruner: Self-Adaptive Context Pruning for Coding Agents (arXiv:2601.16746, Jan 2025)

The SWE-Pruner paper explicitly specifies what makes a good goal hint. It must contain:
- The type of engineering task (bug fix, refactoring, feature addition)
- The identifiers of the code constructs that are being modified
- The expected behavior or error that is being addressed
- The scope of dependency inspection required

Our goal generator produces exactly these fields as a validated JSON structure.

#### Paper 3 — QA-Expand: Multi-Question Answer Generation for Enhanced Query Expansion (arXiv:2502.08557, Feb 2025)

QA-Expand demonstrates that a single expansion pass produces narrow coverage. Instead, generating multiple sub-questions from the original query and filtering them with a feedback model produces significantly richer retrieval signals.

**Alignment**: The structured Goal JSON we produce includes a `retrieval_questions` field — a list of sub-questions such as *"Which callers of AuthService.authenticate handle AuthenticationError?"* and *"Which tests cover the authentication flow?"*. These sub-questions drive the repository retrieval layer in Phase 2, directly paralleling QA-Expand's multi-facet decomposition.

#### Paper 4 — RaFe: Ranking Feedback Improves Query Rewriting (EMNLP Findings, 2024)

RaFe shows that a small query rewriter can be trained without labeled data by using an existing reranker's relevance score as a reward signal. The key insight is that the same model used for ranking can provide the training signal for the query rewriter.

**Alignment**: The existing Qwen3-Reranker-0.6B model produces a `score_logits` value representing the relevance of a code block to a given goal hint. This score can serve as the reward signal to fine-tune the Goal Generator over time, creating a self-improving loop without any human-labeled data. This is a concrete path to long-term quality improvement for the goal synthesis component.

### 1.3 Proposed Design

The Goal Synthesis layer operates as follows:

**Input evidence collected by the VS Code extension:**
- The raw user query
- The active file path and programming language
- The currently focused function or class name (extracted from VS Code's language server)
- The selected or active code region
- Diagnostic messages from the editor (type errors, linter warnings, exceptions)
- Stack trace when available

**Processing:**

A lightweight local instruction model — specifically **Qwen2.5-Coder-1.5B-Instruct (Q4_K_M quantization)** — is prompted to synthesize a Structured Goal JSON. This model is chosen because:

- It is instruction-tuned specifically for code tasks, matching the domain.
- At 1.5B parameters in 4-bit quantization, it requires approximately 1 GB of memory and produces output in under 2 seconds on CPU.
- Its quantized format (GGUF/Q4_K_M) runs natively via `llama.cpp` or Ollama with no Python dependency.

The Structured Goal output contains exactly the fields the SWE-Pruner paper defines as necessary for high-quality goal hints:

| Field | Purpose | Paper Grounding |
|:---|:---|:---|
| `task_type` | Categorize intent (bug_fix, refactor, etc.) | SWE-Pruner §3.1 goal formulation |
| `objective` | Precise, structured description of the goal | SWE-Pruner Goal Hint definition |
| `identifiers` | Class and function names to look up | Query2Doc pseudo-document expansion |
| `observed_errors` | Diagnostic / exception context | SWE-Pruner §4.2 evidence context |
| `retrieval_questions` | Sub-questions for codebase search | QA-Expand multi-facet decomposition |
| `clarification_required` | Flag when evidence is insufficient | User experience safeguard |

**Safeguards (critical for reliability):**

1. **The raw query is always preserved.** The generated Goal supplements but never replaces it. If synthesis fails, the system falls back to the raw query with a template wrapper.
2. **Invented identifiers are filtered.** Any class or function name produced by the LLM that does not appear verbatim in the active file, selected code, or diagnostics is removed. This prevents hallucinated symbol names from corrupting the retrieval step.
3. **Deterministic fallback.** When the local model is unavailable (not installed, timed out, or crashing), a template-based synthesizer deterministically maps known intent keywords (`fix`, `optimize`, `debug`, `add`, `test`) to pre-written structured templates. This ensures the system always produces a valid goal even without the local LLM.
4. **Clarification trigger.** If the query is vague AND no editor evidence is available (no diagnostics, no selected code, no cursor symbol), the system asks the user for clarification rather than guessing.

**Why Qwen2.5-Coder-1.5B and not the Qwen3-Reranker-0.6B already in the system?**

The Qwen3-Reranker-0.6B is a discriminative reranker trained to score relevance between a query and a document. It is not an instruction-following generative model. Using it for text generation would produce meaningless outputs. The SWE-Pruner paper itself uses a separate model for goal generation and the 0.6B skimmer only for line-level scoring. Our architecture maintains this separation by design.

---

## 2. Limitation 2 — AST-Based Repository-Level Context Retrieval

### 2.1 The Core Problem

Single-file pruning is architecturally incapable of serving the information needs of real software engineering tasks. The codebase is a graph of interdependent modules. A developer fixing a bug in a service class needs the pruner to understand the callers, the tests, and the data models — all in different files.

Simply loading every imported file into the context window is dangerous and counterproductive. A real repository contains hundreds of files, producing tens of thousands of tokens — far exceeding any practical context budget. Naive concatenation of all imported files has been empirically shown to *reduce* model performance compared to carefully selected context (HCP-Coder, AAAI 2025).

The solution must be **principled selection**: use structural code analysis to identify which specific symbols from which specific files are relevant, then apply the neural skimmer to prune each one intelligently.

### 2.2 Research Basis for the Proposed Solution

#### Paper 5 — Hierarchical Context Pruning (HCP-Coder): AAAI 2025

**"Hierarchical Context Pruning: Optimizing Real-World Code Completion with Repository-Level Pretrained Code LLMs"** (Zhang et al., AAAI 2025).

HCP-Coder is the most directly relevant paper. It addresses the exact problem: a repository has ~50K tokens, but the LLM can only process ~8K. HCP proposes three key ideas:

1. **Function-level modeling**: Parse the repository into function and class blocks, not raw files. The unit of retrieval is a symbol, not a file.
2. **Topological dependency graph**: Build a call graph connecting functions across files. The graph encodes who calls whom, who inherits from whom, and what each function imports.
3. **Hierarchical budget allocation**: Start from the target symbol. Allocate the most tokens to the target and its direct graph neighbors. Allocate fewer tokens to transitive neighbors. Include only signatures for distant symbols.

**Result**: HCP reduces prompts from ~50K to ~8K tokens while *improving* code completion accuracy on CrossCodeEval compared to naive file concatenation.

**Alignment**: Our architecture adopts HCP's function-level modeling and hierarchical budget allocation directly. The three-tier context output (full body / signature + pruned body / signature only) maps precisely to HCP's three levels of context depth.

#### Paper 6 — GraphCoder: Code Context Graph-based Retrieval (ASE 2024, arXiv:2406.07003)

GraphCoder introduces the **Code Context Graph (CCG)**: a statement-level multi-graph where edges represent control flow, data dependence, and control dependence between statements across a repository.

Its critical innovation is **decay-with-distance weighting**: statements closer in the dependency graph to the completion target receive higher relevance weights. This is a principled way to avoid treating all retrieved context as equally important.

**Alignment**: Our candidate ranker assigns scores using two signals: the graph distance from the active symbol (structural proximity, as in GraphCoder) and the SWE-Pruner document relevance score (semantic relevance). The combination produces a final ranking that is both structurally and semantically grounded.

#### Paper 7 — CodePlan: Repository-Level Coding using LLMs and Planning (NeurIPS FMDM Workshop, 2023; widely cited 2024–2025)

CodePlan uses `tree-sitter` to parse the repository and builds three types of graphs: call graph, import graph, and inheritance graph. It uses **change-impact analysis** to determine which other files are transitively affected by a given edit.

**Alignment**: Our dependency graph construction adopts CodePlan's multi-edge-type approach. For the initial implementation, Python's built-in `ast` module is sufficient for accurate structural parsing without the `tree-sitter` WASM dependency overhead. The transition to `tree-sitter` for multi-language support is explicitly scoped for a later phase.

#### Paper 8 — RepoGraph: Enhancing AI Agent Repository Understanding (arXiv, 2024)

RepoGraph constructs a fine-grained code graph where nodes are individual code lines and edges are functional dependencies (invoke, contain, inherit). It provides **k-hop ego-graph retrieval**: given a focal point (the user's active symbol), extract all code within k graph hops.

**Alignment**: Our graph retrieval step directly implements RepoGraph's ego-graph retrieval. The active symbol is the ego node. We traverse 1 hop to collect callers, callees, and direct test references. We traverse 2 hops for transitive callers. The maximum hop depth is configurable and bounded to prevent context explosion.

#### Paper 9 — SWE-Pruner (arXiv:2601.16746) — Document Relevance Score for Candidate Reranking

The SWE-Pruner model produces two outputs: `token_logits` (line-level keep/prune scores) and `score_logits` (document-level relevance score). The `score_logits` value represents the probability that the entire code block is relevant to the goal — a yes/no generative score derived from the last hidden state projected through the vocabulary.

**Alignment**: After the graph retriever collects candidate symbols, we use the `score_logits` output of the already-loaded Qwen3-Reranker-0.6B to rerank them by semantic relevance. This is a direct reuse of an existing model component for candidate ranking — no new model is introduced. GraphCoder similarly argues that structural proximity alone is insufficient without semantic alignment; our combined ranking implements exactly this principle.

### 2.3 Proposed Design

The repository retrieval layer operates in five sequential steps:

#### Step 1 — Repository AST Indexing

When the user opens a workspace or triggers the repository context command for the first time, the Python backend walks the workspace directory and parses every source file using the appropriate AST parser. For Python, this uses the built-in `ast` module. The index stores, for every file:

- All class and function definitions with their start and end line numbers
- All import statements resolved to workspace-relative file paths
- All method-to-method call relationships discovered through static analysis
- All inheritance relationships
- Test function locations (identified by naming conventions such as `test_` prefixes and `unittest.TestCase` inheritance)

The index is stored in memory and invalidated when the user saves a file. It is never stored on disk, keeping the implementation simple and stateless.

**Paper grounding**: HCP-Coder §3 describes this as "function-level modeling with topological dependency graph construction." CodePlan §4.1 describes this as "incremental dependency analysis."

#### Step 2 — Structured Goal to Retrieval Seeds

The synthesized Goal JSON contains `identifiers` (symbol names to look up) and `retrieval_questions` (natural-language sub-questions). The retrieval process uses two signals:

- **Exact lexical matching**: Every identifier in the Goal JSON is matched directly against the repository index. Any file containing a class or function definition whose name exactly matches an identifier in the Goal is added to the candidate seed set.
- **Sub-question lexical search**: The terms from each `retrieval_question` string are tokenized and matched against all class and function names in the repository index using simple substring matching.

Starting from the active file and the active symbol, the seed set therefore contains: the active file, any file defining a symbol mentioned in the goal, and any file whose symbol names match the sub-question terms.

**Paper grounding**: QA-Expand §3 shows that sub-question decomposition significantly improves retrieval recall. RepoGraph §4 establishes the active symbol as the ego node for graph traversal.

#### Step 3 — Graph Neighbor Expansion

From the seed set, the dependency graph is traversed outward by up to 2 hops:

- **1-hop neighbors (direct dependencies)**: Callers of the active symbol, callees of the active symbol, files imported by the seed files, and test files that reference the active symbol.
- **2-hop neighbors (transitive dependencies)**: Callers of the 1-hop callers, files imported by the 1-hop files.

The hop count is bounded to 2. Going beyond 2 hops empirically floods the context budget with tangentially related symbols, reducing the signal-to-noise ratio. HCP-Coder and RepoGraph both validate this bound empirically.

**Paper grounding**: RepoGraph §5 establishes k-hop ego-graph retrieval with k ≤ 2 as the effective bound. GraphCoder §4.2 establishes that decay-with-distance weighting is necessary precisely because distant neighbors are less relevant.

#### Step 4 — Neural Reranking with SWE-Pruner Document Scores

After graph expansion, there may be 10–30 candidate symbol blocks. These are reranked using the `score_logits` output of the Qwen3-Reranker-0.6B model: the same model already loaded in memory for line-level pruning.

For each candidate symbol block, the model scores how relevant that entire block is to the synthesized goal (not the raw query — the structured goal is used as the query for reranking). The top-ranked candidates proceed to line-level pruning. Lower-ranked candidates are retained only for signature-level inclusion.

**Paper grounding**: GraphCoder §4.3 argues that structural proximity must be combined with semantic relevance for accurate retrieval. SWE-Pruner §3.3 establishes that `score_logits` is a reliable document-level relevance signal. This is the pivotal architectural decision that makes our system uniquely coherent: the same model does both reranking and pruning, with no additional model overhead.

#### Step 5 — Three-Tier Context Assembly with Global Token Budget

The final output is assembled according to the hierarchical budget scheme from HCP-Coder:

**Tier 1 — Critical Symbols (highest-ranked, active file, graph distance 0):**
The full body of each critical symbol is passed through the SWE-Pruner line-level pruner at a lenient threshold (e.g., 0.35). The pruner removes only clearly irrelevant lines while preserving the full logical structure. These symbols receive the largest share of the token budget.

**Tier 2 — Direct Dependencies (graph distance 1):**
The function or method signature (first line only, including type annotations) is always kept. The body is passed through the pruner at an aggressive threshold (e.g., 0.6). Only lines with very high relevance scores are retained. The pruned body is appended after the signature.

**Tier 3 — Transitive Dependencies (graph distance 2 or low relevance score):**
Only the signature line of each class or function is included. No body is retained. This preserves the structural knowledge of what is available in the repository without consuming significant token budget.

Each context block in the output is annotated with:
- The source file path (relative to workspace root)
- The symbol name
- The relationship to the active symbol (e.g., *active symbol*, *caller*, *callee*, *related test*, *imported module*)
- The original line number range

**Paper grounding**: HCP-Coder §3.3 defines precisely this three-level hierarchy and demonstrates it is sufficient to maintain accuracy while staying within an 8K token budget. GraphCoder's decay-with-distance mechanism provides the conceptual basis for the tier assignment. SWE-Pruner's line-level pruner provides the mechanism for body pruning within each tier.

---

## 3. Phased Implementation Order

The two limitations are implemented as four sequential phases to allow validation at each stage before adding complexity:

### Phase 1 — Structured Goal Generator
Implement the goal synthesis pipeline: local Qwen2.5-Coder-1.5B integration, Structured Goal JSON schema and validation, deterministic fallback templates, identifier hallucination filtering, and clarification trigger logic. This phase can be validated independently by verifying that vague queries produce structured, grounded goal descriptions.

**Success criterion**: For the query `"fix auth bug"` with a diagnostic present, the system produces a Structured Goal specifying `task_type: "bug_fix"`, the correct class/method names from the diagnostic, and at least one retrieval question.

### Phase 2 — Repository AST Index and Dependency Graph
Implement the Python AST indexer, repository-wide symbol registry, and dependency graph builder. This phase is independent of the goal synthesizer and can be tested by verifying that the index correctly maps all classes, functions, imports, callers, callees, and test references across a known Python repository.

**Success criterion**: Given the [test-project2](file:///E:/A%20A%20SPL3/test-project2) workspace, the index correctly identifies all class definitions, all import relationships, and at least one caller-callee pair.

### Phase 3 — Retrieval, Reranking, and Pruning
Connect the goal synthesizer output to the retrieval layer: implement lexical seed matching, graph neighbor expansion, SWE-Pruner candidate reranking, three-tier line-level pruning, and global token budget packing. This is the core integration phase.

**Success criterion**: For a query targeting a specific function, the system retrieves and correctly ranks the active symbol (Tier 1), at least one caller and one callee (Tier 2), and at least one test function (Tier 2 or 3), within an 8K token budget.

### Phase 4 — VS Code Extension: Repository Context Command
Implement the `TokenWise: Build Repository Context` VS Code command, the `/prune-workspace` API endpoint, diagnostic collection from VS Code's language server, and the multi-file result panel view. The single-file `/prune` endpoint and existing commands remain unchanged throughout.

**Success criterion**: The command triggers successfully on a Python workspace, collects diagnostics, sends the workspace prune request, and renders the multi-file annotated result in the panel.

---

## 4. Alignment Summary: User's Design vs. Published Research

| Design Decision (User) | Supporting Paper | Why the Alignment Holds |
|:---|:---|:---|
| Use Qwen2.5-Coder-1.5B for goal generation, not the 0.6B reranker | SWE-Pruner (arXiv:2601.16746) | The paper architecturally separates goal generation from token scoring; rerankers are discriminative, not generative |
| Structured JSON goal with identifiers and retrieval questions | Query2Doc (arXiv:2303.07678) + QA-Expand (arXiv:2502.08557) | JSON schema enforces the same structured expansion that pseudo-document generation achieves; multi-field goals parallel QA-Expand's sub-question decomposition |
| Preserve raw query; do not replace it entirely | RaFe (EMNLP 2024) | The reranker feedback loop needs the original query as a reference to measure rewrite quality improvement |
| Fallback deterministic templates when LLM unavailable | Engineering best practice grounded in all cited papers | All papers note that LLM calls introduce latency and failure modes; robustness requires non-LLM fallback |
| Python AST indexer over all files | CodePlan (NeurIPS FMDM 2023) + HCP-Coder (AAAI 2025) | Both papers use static AST analysis as the foundation for dependency graph construction; Python's built-in `ast` module provides sufficient accuracy for initial deployment |
| 1-hop / 2-hop graph expansion with bounded depth | RepoGraph (arXiv 2024) + GraphCoder (ASE 2024) | Both papers empirically establish k ≤ 2 as the effective bound beyond which noise dominates signal |
| Neural reranking of candidates using existing 0.6B model | SWE-Pruner §3.3 + GraphCoder §4.3 | SWE-Pruner's `score_logits` provides an accurate document-level relevance signal; GraphCoder shows structural proximity alone is insufficient without semantic alignment |
| Three-tier context assembly (full / signature+body / signature) | HCP-Coder (AAAI 2025) §3.3 | Directly adopted from HCP-Coder's hierarchical budget allocation, which empirically achieves 50K→8K compression with accuracy improvement |
| Global token budget packing across all files | HCP-Coder §3.4 + RepoGraph §5 | Both papers establish that a single bounded budget shared across all retrieved context is essential to prevent context explosion |
| New `/prune-workspace` endpoint; keep `/prune` intact | Software engineering principle of backward compatibility | Ensures all existing single-file workflows continue to work without modification |
| Include file path, symbol name, and line numbers in output | SWE-Bench evaluation protocol | Evaluation benchmarks require attribution to specific file locations; line number attribution is essential for actionability |

---

## 5. Open Questions for Refinement

1. **Goal generator precision measurement**: How do we quantitatively evaluate whether the Structured Goal improves skimming quality compared to the raw query baseline? A small ablation study on a fixed set of developer queries and code snippets with human-labeled relevance judgments would establish this.

2. **Cross-language support strategy**: The initial AST indexer targets Python. The most common secondary language in the target developer population is TypeScript/JavaScript. Should Phase 2 include a regex-based import resolver for TypeScript as a lightweight fallback, or should full `tree-sitter` WASM parsing be introduced from the start?

3. **Index staleness handling**: The in-memory index must be invalidated when files are saved. For large repositories (>500 files), full re-indexing may take several seconds. A file-watcher-based incremental update strategy (re-index only the changed file and its direct dependents) would improve responsiveness. This parallels CodePlan's "incremental dependency analysis" design, but is scoped to Phase 2 based on observed performance.

4. **Hallucination filtering precision**: The identifier filter that removes LLM-invented symbol names relies on the assumption that relevant identifiers already appear in the active file or selected code. In some cases (e.g., the user is asking about a module they have not yet opened), this filter may be too aggressive. A secondary validation step that checks the repository index before discarding an identifier would improve recall.
