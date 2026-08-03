# TokenWise: Sustainable Context Optimization for Coding Agents
## SE-801: Software Project Lab III
## Technical Report (Software Requirements Specification)

**Submitted by**

Adnan Bin Wahid  
Roll: BSSE-1442

**Supervised by**

Mridha Md. Nafis Fuad  
Lecturer  
Institute of Information Technology  
University of Dhaka

**Submission Date:** 02-08-2026

---

&nbsp;

&nbsp;

&nbsp;

&nbsp;

___________________________  
*Signature of Supervisor*

---

## Abstract

Modern AI-assisted software engineering relies on large language models (LLMs) whose input context grows rapidly as developers pass larger and larger slices of their codebase to the model. This context bloat produces two compounding problems: it drives up inference latency and cost, and it imposes an invisible but real carbon footprint. TokenWise is a Visual Studio Code extension backed by a Python FastAPI service that addresses both problems simultaneously within the developer's existing workflow.

The system integrates four tightly-coupled subsystems grounded in recent software-engineering research. The first subsystem, Goal-Driven Hint Generation, intercepts the developer's natural-language query together with live editor evidence - active file, selected code, cursor symbol, and VS Code diagnostics - and compiles them into a Structured Goal JSON object via a Qwen2.5-Coder local language model, falling back to deterministic template-based synthesis when the model is unavailable. The second subsystem, Line-Level Neural Skimming, uses a fine-tuned SwePrunerForCodePruning model based on Qwen3-Reranker-0.6B with multi-head attention fusion layers and a lightweight compression head to assign per-token relevance scores that are aggregated to line-level decisions, pruning irrelevant lines while preserving syntactic structure. The third subsystem, Adaptive Context Pruning with a three-tier repository budget, builds an import/call dependency graph from AST analysis of the entire workspace and applies graduated pruning intensity: Tier 1 (active file) uses lightly lowered thresholds, Tier 2 (direct imports) applies aggressively raised thresholds, and Tier 3 (transitive references) replaces function bodies entirely with AST-generated signature stubs. The fourth subsystem, Phase-Specific Dual Regressor Carbon Estimation, implements the SEAL measurement framework, routing models with 111 billion parameters or fewer through XGBoost interpolation regressors and models exceeding that threshold through Ridge extrapolation regressors, both trained on a multi-benchmark feature matrix drawn from the SEAL paper's public dataset including MMLU-Pro, BIG-Bench Hard, measured GPU latency, and per-token energy measurements.

This Software Requirements Specification defines the complete scope, functional and non-functional requirements, stakeholders, use-case models, activity flows, dataset description, and preliminary test plan for TokenWise, establishing an unambiguous basis for the design, implementation, and validation of the system in its fully completed form.

---

## Table of Contents

1. Project Overview
   - 1.1 Project Title
   - 1.2 Problem Statement
   - 1.3 Objectives
   - 1.4 Scope
   - 1.5 Deliverables
2. Requirements Analysis
   - 2.1 Quality Function Deployment
   - 2.2 Stakeholders
   - 2.3 Functional Requirements
   - 2.4 Non-Functional Requirements
   - 2.5 Usage Scenarios
3. System Modeling
   - 3.1 Use Case Diagram
   - 3.2 Activity Diagram
4. Dataset Description
5. Preliminary Test Plan
6. Timeline

---

## 1. Project Overview

### 1.1 Project Title

**TokenWise: Sustainable Context Optimization for Coding Agents - A VS Code Extension with Dual-Phase Carbon Estimation and Line-Level Neural Context Pruning**

---

### 1.2 Problem Statement

The adoption of AI-assisted coding tools has accelerated dramatically. Developers now routinely ask coding agents embedded inside tools like GitHub Copilot, Cursor, and Continue.dev to navigate, fix, refactor, and explain code across an entire repository. The quality of the agent's response depends critically on the context it receives. In practice, developers either (a) pass the entire file or workspace indiscriminately, overwhelming the model's context window and inflating cost, or (b) manually curate the context themselves, which is slow, error-prone, and not scalable.

This creates three distinct, interrelated problems that current tooling does not address in combination.

**Problem 1 - Context Bloat and Irrelevant Noise.** A typical workspace for a medium-sized Python project contains thousands of lines of code spanning dozens of files. When a developer asks a coding agent to "fix the authentication bug," only a handful of methods, classes, and import chains are truly relevant. Passing all files to the model introduces noise that degrades response quality and consumes unnecessary tokens. Token consumption directly translates to monetary cost on commercial models and latency on local models. Yet developers have no automated, query-aware mechanism to identify and include only relevant portions of their codebase.

**Problem 2 - Lack of Syntactic Structure Preservation.** Naive token truncation strategies remove code at arbitrary character offsets, breaking function signatures, class hierarchies, and import declarations. A useful context pruner must understand syntactic boundaries: it must preserve the function header even if the body is irrelevant, keep class declarations even if methods are pruned, and maintain import statements that other retained code depends on.

**Problem 3 - Invisible Environmental Footprint.** Every prompt sent to an LLM consumes electrical energy on the server-side GPU. This energy corresponds to carbon emissions that depend on the GPU type, the model size, the geographic grid carbon intensity, the number of input tokens (prefill phase), and the number of generated output tokens (decode phase). These two phases have fundamentally different energy profiles: prefill processing is compute-bound and scales with input length, whereas decode is memory-bandwidth-bound and scales with output length. No current developer tool surfaces these costs to the developer, let alone shows how much carbon they saved by pruning context.

TokenWise addresses all three problems within one integrated, in-editor tool. By intercepting the developer's query, synthesizing a structured search goal, using a fine-tuned neural model to score and prune code at line granularity, respecting import and call dependencies when assembling multi-file context, and estimating the resulting energy and CO2 savings with a phase-specific dual regressor, TokenWise transforms the routine act of sending a prompt into a sustainable, precision-engineered workflow.

---

### 1.3 Objectives

The objectives of this project are to:

1. **Goal-Driven Hint Generation:** Automatically transform a developer's natural-language query, combined with live editor evidence (active file, selected code, cursor symbol, VS Code diagnostics), into a machine-readable Structured Goal JSON that identifies the task type, target identifiers, observed errors, required context files, and retrieval questions needed to localize the relevant code.

2. **Line-Level Neural Skimming:** Using a fine-tuned transformer model (SwePrunerForCodePruning, a Qwen3-Reranker-0.6B derivative augmented with multi-head attention fusion layers and a lightweight FFN compression head), assign per-token relevance scores to every token in a code file relative to the synthesized objective, aggregate these scores to line-level decisions using character-offset mapping, and prune irrelevant lines while retaining syntactic boundaries and fragment markers.

3. **Adaptive Context Pruning with Tier Budgeting:** Build a complete import/call dependency graph from AST analysis of the workspace at request time, traverse the graph using BFS to assign hop-distances from the active file, and apply graduated pruning intensity across three tiers - Tier 1 (active file, light pruning), Tier 2 (direct imports, aggressive pruning), and Tier 3 (transitive references, signature-stub generation only) - to pack the most relevant context within the available token budget.

4. **Multi-Benchmark Feature Fusion for Carbon Modeling:** Construct a feature matrix for each LLM using publicly available benchmark scores (MMLU-Pro, BIG-Bench Hard), hardware profiling metrics (GPU type, measured per-token latency), and model metadata (parameter count), drawn from the SEAL paper's dataset, to train phase-specific energy regression models.

5. **Prompt-Level Carbon Estimation (SEAL framework):** Implement the SEAL paper's carbon estimation methodology to calculate prefill energy (Joules) and decode energy (Joules) separately for each inference call, convert total Joules to CO2 grams using the regional grid carbon intensity, and surface both the before-pruning and after-pruning estimates alongside the carbon saved.

6. **Phase-Specific Dual Regressor Engine:** Train and deploy two separate sets of regression models - XGBoost regressors for models with parameter counts within the training distribution (<=111B, interpolation regime) and Ridge regressors for models beyond the training distribution (>111B, extrapolation regime) - each predicting prefill and decode energy independently using the 8-feature matrix derived from the benchmark fusion step.

7. **Sustainability Dashboard and Feedback Loop:** Provide a rich VS Code Webview panel displaying pruning statistics (original tokens, pruned tokens, reduction percentage, rerank score per file), structured goal details, per-file tier assignments, a side-by-side code diff of the original and pruned content, and a carbon impact section showing prefill Joules saved, decode Joules saved, total Joules saved, and CO2 grams avoided; and maintain a live VS Code status bar item showing cumulative session CO2 savings.

---

### 1.4 Scope

**In scope:** TokenWise is delivered as a Visual Studio Code extension with a supporting Python FastAPI backend service. Its functional scope covers:

- Natural-language query intake combined with live VS Code editor state (active file, selected code, cursor symbol position, and editor diagnostics) to form a structured search goal.
- Neural relevance scoring using a fine-tuned Qwen3-Reranker-0.6B model augmented with multi-head attention self-fusion and a configurable compression head (FFN, simple linear, or CRF), with large file handling via token-level chunking and score averaging across overlapping windows.
- Multi-file workspace context assembly using an AST-based Python import/call dependency graph traversed by BFS, with three graduated pruning tiers applied based on graph distance from the active file.
- Lexical and graph-based candidate retrieval feeding into neural reranking to select which files enter each tier, with keyword-filtered Python language stop-words preventing hallucinated identifier propagation.
- Carbon estimation for the prefill and decode phases of any registered LLM, using dual-mode regression (XGBoost interpolation / Ridge extrapolation) trained on SEAL benchmark data, with a fallback constant-based estimator when artifact files are missing.
- A model registry (JSON) containing per-model metadata including parameter count, MMLU-Pro and BBH scores, and GPU latency measurements for all models present in the SEAL dataset.
- A VS Code Webview panel presenting pruning results (single-file and workspace-level), carbon impact, file-level tables, and one-click copy/insert actions.
- A VS Code status bar item that updates to show cumulative session CO2 grams saved after each pruning operation.
- Operation on Python-language workspaces.

**Out of scope:**

- Fine-tuning, re-training, or otherwise modifying the backbone Qwen3-Reranker-0.6B model weights.
- Real-time execution or dynamic analysis of the user's code for security auditing or test running.
- Retrieval-augmented generation (RAG) over external documentation corpora, package indexes, or the internet.
- Support for languages other than Python in the AST indexer.
- Integration with continuous integration pipelines, cloud deployments, or production LLM API providers as a hosted proxy.
- User account management, authentication, or cloud storage of pruning history.

---

### 1.5 Deliverables

**Software Deliverables**

- A Visual Studio Code extension (TokenWise) providing a command palette interface with four registered commands: Prune Selected Code, Prune Current File, Check Health, and Build Repository Context.
- A Python FastAPI backend service exposing four REST endpoints: GET /health, POST /prune, POST /prune-workspace, and POST /estimate-carbon, served by Uvicorn with single-threaded OpenMP configuration for Windows CPU stability.
- The Goal Compilation subsystem: GoalCompiler, LocalGoalGeneratorClient, and StructuredGoal Pydantic model with Qwen2.5-Coder integration and deterministic INTENT_TEMPLATES fallback.
- The Neural Skimming subsystem: SwePrunerForCodePruning (wrapper), SwePrunerForCodeCompression, TokenScorer (with CRF, FFN, and simple compression head variants), chunk splitter, token-to-line score aggregator, and line pruner with single-gap preservation logic.
- The Repository Indexing subsystem: PythonASTIndexer using Python's built-in ast module to extract classes, functions, imports, and call sites; RepositoryIndex to traverse the workspace and build the per-file metadata map; and DependencyGraph to resolve import and symbol-call edges into a directed adjacency list.
- The Retrieval subsystem: LexicalRetriever for identifier-based seed file lookup, GraphRetriever for BFS hop-distance traversal, CandidateRanker for neural reranking using score_logits from the pruner model, and ContextBuilder for three-tier pruning and unified prompt assembly.
- The Carbon Estimation subsystem: DualModeRegressorEngine loading four artifact files (XGBoost prefill, XGBoost decode, Ridge prefill, Ridge decode), CarbonEstimator resolving model features from model_registry.json and feature_artifacts.json.
- The Carbon Engine training pipeline in carbon-engine/src/carbon_engine/: schema, registry, feature engineering, dual-mode modeling, inference, merge, and IO utilities, producing the four artifact files consumed by the estimator at runtime.
- A trained model registry (carbon_artifacts/model_registry.json) containing features for all LLMs present in the SEAL dataset.
- The VS Code Webview panel (ResultPanel) with two HTML rendering modes: single-file pruning result with side-by-side code diff and carbon impact section, and workspace pruning result with goal detail card, file table, and unified prompt preview.
- The VS Code status bar item tracking cumulative session CO2 savings.

**Documentation Deliverables**

- This technical report documenting the project's overview, requirements, system and data models, dataset description, and preliminary test plan.
- README.md with installation, model download, server startup, and extension usage instructions.
- SEAL-IMPLEMENTATION-PROGRESS.md documenting the end-to-end SEAL carbon estimation implementation, training data pipeline, and regressor validation results.
- Manual test result documents (MANUAL-TEST-RESULTS.md) recording end-to-end test sessions with actual pruning ratios and carbon estimates.

---

## 2. Requirements Analysis

### 2.1 Quality Function Deployment

Quality Function Deployment (QFD) is a structured methodology used to translate stakeholder requirements into specific system features, guiding design priorities. Based on observations of developers using AI coding assistants, the following requirements were identified and classified:

#### 2.1.1 Normal Requirements

These are baseline expectations that must be present for the tool to be considered functional:

- **Health Endpoint:** The extension must be able to verify whether the backend service is running and whether the neural pruner model is loaded before accepting pruning requests.
- **Single-File Pruning:** Users can invoke pruning on the currently active file or a selected code block, receiving a pruned version along with the pruning score and token counts.
- **Carbon Estimation:** Users can request a carbon estimate for a given number of input and output tokens targeting a named LLM model, receiving prefill Joules, decode Joules, total Joules, and CO2 grams.
- **Configuration:** Users can configure the backend API URL, default pruning threshold, and optional local LLM URL and model name through VS Code workspace settings.
- **Webview Result Panel:** Pruning results are displayed in a dedicated side-panel Webview with clearly labeled metrics (original tokens, pruned tokens, reduction percentage, and score).

#### 2.1.2 Expected Requirements

These requirements are expected by developers familiar with AI coding tooling:

- **Workspace-Level Context Building:** When editing a file in a multi-file Python project, users can trigger a repository-wide pruning operation that collects all Python files, builds a dependency graph, and returns a unified context prompt organized by file tier and relevance.
- **Goal Synthesis from Editor State:** The system must interpret the user's query in the context of their current editing session - reading the active file, selected text, cursor symbol, and any VS Code language-server diagnostics - and formulate a precise search objective before retrieving candidates.
- **Identifier-Based Retrieval:** Candidate files selected for the workspace context must contain identifiers referenced in the synthesized goal, preventing retrieval of entirely unrelated modules.
- **Line-Level Granularity:** Pruning must operate at the level of individual code lines, not token-ranges or file-level inclusion/exclusion, so that partial functions, docstrings, and method bodies can be selectively stripped.
- **Token Count Transparency:** The result panel must display the exact original and pruned token counts at both the file level and workspace level.
- **Insert at Cursor Action:** Users can insert the pruned code or unified context directly into their active editor at the current cursor position with a single button click.

#### 2.1.3 Exciting Requirements

These requirements differentiate TokenWise from generic code compression tools:

- **Phase-Specific Dual Regressor Carbon Estimation:** The carbon estimator separately models the prefill (input token processing) and decode (token generation) phases of LLM inference, using different regression algorithms for interpolation vs. extrapolation regimes, producing more accurate estimates than a single flat per-token coefficient.
- **Three-Tier Graduated Context Assembly:** Instead of binary include/exclude decisions, the system applies three distinct pruning intensities: lightly prune the active file, aggressively prune direct imports, and replace transitive dependencies with AST-generated function signature stubs.
- **Live Carbon Savings Status Bar:** The VS Code status bar displays a live, running total of CO2 grams saved in the current session, creating a real-time sustainability feedback loop that makes environmental impact visible and gamifiable.
- **SEAL-Benchmark-Grounded Energy Estimation:** Carbon estimates are derived from a regression model trained on the SEAL paper's public benchmark dataset, which includes GPU energy measurements from real hardware inference runs for a diverse set of LLMs.
- **CRF Compression Head for Sequence-Aware Pruning:** The neural model's compression head can be configured as a Conditional Random Field (CRF) layer, enabling the model to learn transition probabilities between "keep" and "prune" labels at adjacent token positions, producing more coherent pruning boundaries.

---

### 2.2 Stakeholders

Stakeholders are individuals or groups who are actively involved in the system, directly interact with it, or are impacted by its operation.

**Primary Stakeholders (Direct Interaction)**

| Stakeholder | Role | Interest / Need |
|---|---|---|
| Software Developer | Primary Actor | Uses the extension to reduce context bloat and environmental footprint when querying coding agents. Needs accurate, fast, and transparent pruning with minimal setup. |
| Researcher / Evaluator | Primary Actor | Inspects the carbon estimation system, audit trail, and pruning quality against academic benchmarks. Needs detailed metrics, feature provenance, and reproducible model artifacts. |

**Secondary Stakeholders (Indirect Interaction)**

| Stakeholder | Role | Interest / Need |
|---|---|---|
| Local LLM Service (Qwen2.5-Coder via Ollama) | Secondary Actor | Receives goal-synthesis prompts from LocalGoalGeneratorClient and responds with structured JSON. Needs well-formed prompt templates. |
| Neural Pruner Model (HuggingFace ayanami-kitasan/code-pruner) | Secondary Actor | Loaded once at server startup; receives tokenized query+code inputs and returns token_logits and score_logits. |
| VS Code Language Server | Secondary Actor | Supplies real-time diagnostic errors and warnings to the extension for inclusion in the goal synthesis prompt. |

---

### 2.3 Functional Requirements

#### Goal Compilation (FR-GC)

- **FR-GC.1:** The system shall accept a natural-language query string from the developer.
- **FR-GC.2:** The system shall read the active file path, the selected code text (if any), the word under the cursor (if no selection), and all VS Code error/warning diagnostics for the active file, and include them in the goal synthesis prompt.
- **FR-GC.3:** The system shall submit the assembled prompt to the locally running Qwen2.5-Coder LLM via HTTP POST to the configured local_llm_url, requesting a structured JSON response conforming to the StructuredGoal schema: task_type, objective, identifiers, observed_errors, required_context, retrieval_questions, and clarification_required.
- **FR-GC.4:** If the LLM call fails, is unavailable, or returns an unparseable response, the system shall fall back to deterministic INTENT_TEMPLATES keyed on the leading verb of the query (fix, optimize, add, remove, refactor, test, debug, understand) and extract candidate identifiers using regex, excluding Python language keywords.
- **FR-GC.5:** The system shall post-process the identifiers list from the synthesized goal to remove any identifier that does not appear verbatim in the query, selected code, current symbol, or diagnostics, preventing hallucinated identifiers from polluting the retrieval step.
- **FR-GC.6:** If the query is extremely vague and no editor evidence is present, the system shall set clarification_required: true and skip retrieval without returning an error.

#### Repository Indexing (FR-RI)

- **FR-RI.1:** The system shall recursively traverse the workspace root directory and collect all .py files, excluding .venv, node_modules, .git, and __pycache__ directories.
- **FR-RI.2:** For each collected file, the system shall parse its source code using Python's built-in ast module and extract: (a) class definitions with their method lists, line ranges, base classes, and a test-class flag; (b) top-level function definitions with line ranges and a test-function flag; (c) all import and from-import statements as module path strings; (d) all function/method call sites as symbol names.
- **FR-RI.3:** The system shall build a directed dependency graph by resolving each import path suffix against the set of known repository file paths, and by resolving each call symbol against the set of known class/function definitions in the repository.
- **FR-RI.4:** The dependency graph shall maintain both forward edges (file A imports file B) and reverse edges (file B is imported by file A), supporting bidirectional BFS traversal.
- **FR-RI.5:** The system shall maintain a symbol definition map from symbol name to the list of repository files defining it, enabling cross-file call resolution.

#### Candidate Retrieval (FR-CR)

- **FR-CR.1:** The system shall query the repository index for all files whose extracted identifier list contains at least one identifier from the goal's identifiers field, using whole-word regex matching.
- **FR-CR.2:** The system shall always include the active file in the seed set regardless of identifier match.
- **FR-CR.3:** The system shall perform a BFS traversal of the dependency graph from the seed set up to a configurable number of hops (default: 1), assigning each reachable file a minimum hop distance.
- **FR-CR.4:** Files with at least one matched goal identifier or the active file shall be submitted to the neural reranker. All other candidate files shall be assigned a default low score (-5.0) and treated as Tier 3 without reranking.
- **FR-CR.5:** The neural reranker shall score each candidate file by feeding the goal objective and the first 12,000 characters of the file content through the loaded SwePrunerForCodeCompression model and reading the score_logits output.
- **FR-CR.6:** All candidates, ranked and default-scored, shall be merged and sorted in descending score order before context packing.

#### Neural Line-Level Pruning (FR-NP)

- **FR-NP.1:** The system shall tokenize the query and code using the Qwen3-Reranker-0.6B tokenizer and format them using the ChatML instruction template with a fixed system message, instruction preamble, and assistant prefix.
- **FR-NP.2:** If the code exceeds the available token window (8192 minus prefix/suffix minus query tokens), the system shall split the code into overlapping chunks using token-level offset mapping, with a configurable overlap (default: 50 tokens). Each chunk shall be processed independently and its token scores shall be averaged at the absolute character-position level across all chunks.
- **FR-NP.3:** The model shall produce token_logits for every code token in the sequence. These logits shall be converted to probabilities via sigmoid and mapped back to the original code's character offsets. For each source line, the system shall compute the mean probability across all tokens whose character offsets fall within that line's character range.
- **FR-NP.4:** Lines with a mean probability >= threshold shall be kept; lines below threshold shall be pruned. If exactly one line exists between two kept lines (single-gap), that line shall be preserved unconditionally to avoid spurious isolated (filtered N lines) markers.
- **FR-NP.5:** Pruned line ranges shall be replaced in the output with a (filtered N lines) marker counting the number of removed non-empty lines, so the coding agent understands structure was removed.
- **FR-NP.6:** The model shall also produce a score_logits value (log probability of "yes") representing the overall relevance of the code chunk to the query, returned as the score field of the pruning response.
- **FR-NP.7:** On CPU inference, the system shall disable autocast to prevent mixed-dtype errors in the compression head, and shall enforce single-threaded OpenMP, MKL, OpenBLAS, and NUMEXPR environments at process startup.

#### Context Assembly (FR-CA)

- **FR-CA.1:** The system shall organize retrieved files into three tiers based on graph hop-distance and rerank score. Distance 0 (active file) -> Tier 1. Distance 1 with score > -2.0 -> Tier 2. All others -> Tier 3.
- **FR-CA.2:** For Tier 1 files, the system shall apply the neural pruner with a threshold lowered by 0.15 below the user-configured value to maximize retention of the active file's content.
- **FR-CA.3:** For Tier 2 files, the system shall apply the neural pruner with a threshold raised by 0.15 above the user-configured value to aggressively compress direct dependencies, capped at 0.85.
- **FR-CA.4:** For Tier 3 files, the system shall not run the neural pruner. Instead, it shall generate synthetic signature stubs using the file's AST metadata: class ClassName: followed by indented def method_name(self, ...): ... for each method, and def function_name(...): ... for module-level functions.
- **FR-CA.5:** Test files (whose path contains the substring "test") shall be labeled as "related test" in the relation field regardless of tier.
- **FR-CA.6:** Each file's context block shall be formatted as a Markdown code fence preceded by a header line giving the relative path, relation label, and tier number.
- **FR-CA.7:** The system shall return the concatenated unified prompt, the per-file summary list (path, relation, tier, original tokens, pruned tokens, rerank score), and aggregate token counts.

#### Carbon Estimation (FR-CE)

- **FR-CE.1:** The system shall accept a CarbonEstimateRequest containing: input token count, output token count, model name, optional model size in billions of parameters, GPU type, per-token prefill latency in milliseconds, per-token decode latency in milliseconds, optional MMLU-Pro score, optional BBH score, and carbon grid intensity in gCO2/kWh.
- **FR-CE.2:** The system shall resolve missing model features (size, benchmark scores, GPU type) by looking up the model name in model_registry.json, falling back to built-in DEFAULT_MODEL_REGISTRY constants if the registry file is absent.
- **FR-CE.3:** The system shall encode the GPU type into an integer using the gpu_encoder mapping from feature_artifacts.json, falling back to 0 if the GPU type is not registered.
- **FR-CE.4:** The system shall route the estimation request to the XGBoost interpolation regressors if the model size is <=111.0 billion parameters, and to the Ridge extrapolation regressors if the model size exceeds 111.0 billion parameters.
- **FR-CE.5:** The regressors shall predict prefill and decode energy values trained on 256-token input / 128-token output benchmarks. The system shall scale these predictions by (n_input_tokens / 256) for prefill and (n_output_tokens / 128) for decode.
- **FR-CE.6:** If the artifact files are missing or the regressors fail to load, the system shall fall back to constant-based estimation using MODEL_CONSTANTS scaled by the latency parameters, and shall mark features_source as fallback_constants in the response.
- **FR-CE.7:** CO2 grams shall be calculated as (total_joules / 3_600_000) * carbon_intensity_g_per_kwh.
- **FR-CE.8:** All energy values in the response shall be clamped to a minimum of 0.0 Joules.

#### Frontend Extension (FR-FE)

- **FR-FE.1:** The extension shall register four VS Code commands: tokenwise.pruneSelected, tokenwise.pruneCurrentFile, tokenwise.checkHealth, and tokenwise.buildRepositoryContext.
- **FR-FE.2:** tokenwise.pruneSelected shall prune the currently selected text against a query obtained from an input box, call POST /prune and POST /estimate-carbon before and after, compute savings, and display results in the Webview panel.
- **FR-FE.3:** tokenwise.pruneCurrentFile shall prune the entire active file's content, following the same pipeline as FR-FE.2.
- **FR-FE.4:** tokenwise.checkHealth shall call GET /health and display an information message indicating whether the backend is reachable and whether the model is loaded.
- **FR-FE.5:** tokenwise.buildRepositoryContext shall prompt the developer for a query, collect editor state, call POST /prune-workspace, and display the workspace pruning results in the Webview panel.
- **FR-FE.6:** The Webview panel for single-file pruning shall display the query, four stat cards (score, original tokens, pruned tokens, reduction percent), a skimming details card (model input tokens, kept fragment line numbers), an optional carbon impact card (prefill saved, decode saved, total saved, CO2 avoided), and a side-by-side grid of original and pruned code.
- **FR-FE.7:** The Webview panel for workspace pruning shall display three stat cards (original workspace tokens, pruned workspace tokens, total reduction), a synthesized goal detail card (task type, identifiers, objective, errors), a file table (path, relation, tier, original tokens, pruned tokens, rerank score), and a full unified prompt preview.
- **FR-FE.8:** The VS Code status bar item shall show $(filter) TokenWise when no savings exist, and $(leaf) TokenWise X.XXXXXXg saved when cumulative CO2 savings are positive, updating after each pruning operation.
- **FR-FE.9:** The Webview shall provide Copy and Insert buttons allowing the developer to copy the pruned output to the clipboard or insert it at the cursor position in one click.

---

### 2.4 Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | The /prune endpoint shall complete inference for a single file of up to 8,192 model-input tokens on a CPU-only server within a time suitable for interactive use (target: <=30 seconds for single-file). Workspace pruning time scales with the number of relevant files. |
| NFR-2 | Reliability | The system shall fall back gracefully at every failure boundary: LLM goal synthesis failure -> deterministic templates; regressor artifact missing -> constant-based carbon fallback; model not loaded -> HTTP 500 with descriptive message. The extension shall never crash VS Code. |
| NFR-3 | Thread Safety | The backend shall enforce single-threaded OpenMP, MKL, OpenBLAS, NumExpr, and PyTorch thread counts at process startup. CPU-bound inference and ranking calls shall be executed in asyncio background threadpool workers using asyncio.to_thread to prevent event loop blocking. |
| NFR-4 | Security | The backend shall not execute user-submitted code. The Webview HTML shall escape all user-controlled strings (query, file paths, code content) using escapeHtml() before injection, preventing XSS within the VS Code Webview context. |
| NFR-5 | Portability | The backend shall detect CUDA availability at runtime and move the model to GPU if available, or remain on CPU otherwise, without requiring manual configuration. The VS Code extension shall support all platforms that VS Code supports (Windows, macOS, Linux). |
| NFR-6 | Explainability | Every carbon estimate response shall include prefill_route, decode_route, and features_source fields so that the developer knows whether the estimate came from trained regressors or fallback constants and which algorithm was used. |
| NFR-7 | Maintainability | Language-specific AST indexing logic shall be isolated behind PythonASTIndexer so that additional language adapters can be registered without modifying the retrieval or context assembly pipeline. |
| NFR-8 | Extensibility | The compression head architecture (FFN, simple linear, CRF) shall be selectable via a configuration field in the model config, enabling future training runs to explore different head designs without changing the inference pipeline. |
| NFR-9 | Privacy | All user queries and code are processed locally: the backend runs on the developer's machine, the neural model runs locally, and the only optional external call is to the locally hosted Ollama LLM service. No user data is transmitted to external servers. |
| NFR-10 | Auditability | The response payload for workspace pruning shall include the full structured goal JSON, per-file tier and score assignments, and aggregate token counts, providing a complete audit trail of every context-building decision. |

---

### 2.5 Usage Scenarios

#### 2.5.1 Backend Server Setup

The developer starts the TokenWise backend server using the command `swe-pruner serve --model-path ./model`. The server checks that config.json and model.safetensors exist in the model directory. If valid, it loads SwePrunerForCodePruning via HuggingFace's from_pretrained, detects whether CUDA is available, moves the model to the appropriate device, casts it to float32 for CPU or float16 for CUDA, and places it in evaluation mode. The CarbonEstimator is initialized by loading feature_artifacts.json and model_registry.json from the ./carbon_artifacts directory, and the four regressor artifact files are deserialized using joblib (Ridge) and the XGBoost API. The server then listens on 0.0.0.0:8000.

#### 2.5.2 Extension Setup and Configuration

The developer installs the TokenWise VS Code extension. In workspace settings (tokenwise.*), they configure the backend URL (default: http://localhost:8000), the default pruning threshold (default: 0.45), and optionally a local LLM URL and model name for goal synthesis. The status bar item $(filter) TokenWise appears in the lower-left corner. The developer clicks the status bar item, which triggers tokenwise.checkHealth and shows a notification: "TokenWise: Backend healthy, model loaded" or the appropriate error message.

#### 2.5.3 Single-File Pruning with Carbon Estimation

The developer opens a Python file, selects a function body, and invokes TokenWise: Prune Selected Code from the command palette. An input box prompts for the pruning query, e.g., "optimize database connection logic". The extension calls POST /estimate-carbon with the original token count to obtain a "before" carbon estimate. It then calls POST /prune with the query, selected code, and threshold. On receiving the response, it calls POST /estimate-carbon again with the pruned token count to obtain an "after" estimate. The carbon savings are computed as the difference. The Webview panel opens beside the editor showing the pruning score, original vs. pruned token counts, token reduction percentage, prefill/decode/total Joules saved, CO2 grams avoided, and a side-by-side code comparison. The status bar updates to show cumulative CO2 savings.

#### 2.5.4 Workspace Repository Context Building

The developer is editing auth/service.py and types "fix the JWT validation bug" into the query input box triggered by TokenWise: Build Repository Context. The extension collects: active file path = auth/service.py; selected code = (none); current symbol = validate_token (word under cursor); diagnostics = ["NameError: name 'jwt' is not defined"]; workspace root; and threshold.

The extension sends a POST /prune-workspace request. The backend GoalCompiler calls the local Qwen2.5-Coder model with a structured prompt, receiving back task_type: "bug_fix", identifiers: ["validate_token", "jwt", "JWTError"], observed_errors: ["NameError: name 'jwt' is not defined"]. The post-processor filters identifiers to only those present in the source query, selected code, symbol, and diagnostics.

RepositoryIndex traverses the workspace, parsing all .py files with PythonASTIndexer. DependencyGraph resolves imports and call symbols into a directed graph. LexicalRetriever finds all files containing validate_token, jwt, or JWTError. GraphRetriever performs a 1-hop BFS from these seed files, assigning distances. The CandidateRanker scores each matched file against the objective. ContextBuilder packages: auth/service.py as Tier 1 (lightly pruned), auth/utils.py and models/user.py as Tier 2 (aggressively pruned), and config/settings.py as Tier 3 (signature stubs only).

The Webview panel shows the synthesized goal, the per-file table with tiers and rerank scores, and the full unified prompt ready to be copied into the developer's preferred coding agent.

#### 2.5.5 Carbon Estimation Query

The developer invokes POST /estimate-carbon with input_tokens=3500, output_tokens=512, model_name="llama-3-70b". The CarbonEstimator looks up llama-3-70b in model_registry.json, finding model_size_b = 70.0. Since 70.0 <= 111.0, the DualModeRegressorEngine routes to the XGBoost regressors. It assembles an 8-feature row and calls xgb_prefill.predict(features), scaling the output by 3500/256. Then xgb_decode.predict(features), scaling by 512/128. The response includes prefill Joules, decode Joules, total Joules, CO2 grams (at 475 gCO2/kWh default), route labels, and features source.

---

## 3. System Modeling

### 3.1 Use Case Diagram

A Use Case describes the system behavior under various conditions as the system responds to requests from its stakeholders. The TokenWise system comprises four major use-case groups, corresponding to the four registered VS Code commands and their backend orchestration pipelines.

**Actors:**

**Primary Actor:** Developer

**Secondary Actors:**
- Local LLM Service (Qwen2.5-Coder via Ollama, 127.0.0.1:11434)
- Neural Pruner Model (Qwen3-Reranker-0.6B, ayanami-kitasan/code-pruner)
- Python AST Module (built-in ast library)

#### Level 0: TokenWise System

```
Name: TokenWise
Primary Actor: Developer
Secondary Actors: Local LLM Service, Neural Pruner Model, Python AST Module

[Developer] -----> (TokenWise System) -----> [Local LLM Service]
                                       -----> [Neural Pruner Model]
                                       -----> [Python AST Module]
```

*Figure 1: Level 0 TokenWise Use Case Diagram*

#### Level 1: TokenWise (Detailed)

```
Name: TokenWise (Detailed)
Primary Actor: Developer

[Developer] ----> (Check Backend Health)
[Developer] ----> (Prune Selected Code / Current File)
[Developer] ----> (Build Repository Context)
[Developer] ----> (Estimate Carbon Footprint)

(Prune Selected Code / Current File) ..includes.. (Estimate Carbon Footprint)
(Build Repository Context) ..includes.. (Synthesize Structured Goal)
(Build Repository Context) ..includes.. (Index Repository AST)
(Build Repository Context) ..includes.. (Retrieve Candidate Files)
(Build Repository Context) ..includes.. (Rank Candidates Neurally)
(Build Repository Context) ..includes.. (Assemble Tiered Context)

(Synthesize Structured Goal) ..uses.. [Local LLM Service]
(Rank Candidates Neurally)   ..uses.. [Neural Pruner Model]
(Prune Code)                 ..uses.. [Neural Pruner Model]
(Index Repository AST)       ..uses.. [Python AST Module]
```

*Figure 2: Level 1 TokenWise Detailed Use Case Diagram*

#### Level 1.1: Goal Synthesis Module

```
Name: Goal Synthesis
Primary Actor: Developer
Secondary Actor: Local LLM Service

Use Cases:
1. Collect Editor Evidence: Read active file, selected code, cursor symbol, diagnostics.
2. Build Synthesis Prompt: Assemble a structured ChatML prompt with all editor context.
3. Call Local LLM: POST to Qwen2.5-Coder at configured endpoint.
4. Parse Structured Goal JSON: Extract task_type, objective, identifiers, observed_errors.
5. Post-Process Identifiers: Filter hallucinated identifiers not in source context.
6. Deterministic Fallback: If LLM unavailable, apply INTENT_TEMPLATES classification.
```

*Figure 3: Goal Synthesis Use Case Diagram*

**Step-by-step description:**
1. The extension reads the active document URI, the selected text region, the word at cursor position, and all Error and Warning diagnostics reported by VS Code's language service.
2. The GoalCompiler.build_prompt() method constructs a ChatML-formatted prompt embedding all editor evidence and the developer's raw query, requesting a StructuredGoal JSON response.
3. LocalGoalGeneratorClient sends an HTTP POST to the Ollama completions API at the configured endpoint.
4. The client deserializes the LLM response into a StructuredGoal Pydantic model.
5. The compiler strips identifiers that cannot be verified against the query, selected code, current symbol, or diagnostics.
6. On any failure, GoalCompiler.deterministic_fallback() applies INTENT_TEMPLATES, classifies the task type, extracts identifiers by regex, and constructs a valid StructuredGoal without LLM involvement.

#### Level 1.2: Repository Context Pruning Module

```
Name: Repository Context Pruning
Primary Actor: Developer
Secondary Actors: Python AST Module, Neural Pruner Model

Use Cases:
1. Index Workspace Files: Traverse workspace, parse all .py files with AST.
2. Build Dependency Graph: Resolve imports and call symbols into directed edges.
3. Lexical Retrieval: Find seed files containing goal identifiers.
4. Graph Traversal (BFS): Expand candidate set by hop-distance from seeds.
5. Neural Reranking: Score each candidate file by relevance to the goal objective.
6. Tier Assignment: Classify files into Tier 1, 2, or 3 by distance and score.
7. Tier-1 Light Pruning: Apply neural pruner with lowered threshold on active file.
8. Tier-2 Aggressive Pruning: Apply neural pruner with raised threshold on direct imports.
9. Tier-3 Signature Stub Generation: Generate AST-based class/function stubs.
10. Assemble Unified Prompt: Concatenate all blocks with file headers and relation labels.
```

*Figure 4: Repository Context Pruning Use Case Diagram*

**Step-by-step description:**
1. RepositoryIndex.build_index() walks the workspace tree with PythonASTIndexer, building a map from relative path to AST metadata.
2. DependencyGraph.build_graph() resolves import paths and call symbols into forward and reverse adjacency sets.
3. LexicalRetriever.search_identifiers() uses whole-word regex to find files containing goal identifiers.
4. GraphRetriever.get_neighbors() performs BFS for up to max_hops hops, assigning minimum distances.
5. CandidateRanker.rank_candidates() scores each filtered candidate using score_logits from the loaded pruner model.
6. ContextBuilder.pack_context() classifies each file by its hop-distance and score.
7-9. Each tier receives the appropriate pruning treatment as defined in FR-CA.
10. Blocks are joined with double newlines to produce the unified_prompt.

#### Level 1.3: Single-File / Selected-Code Pruning Module

```
Name: Single-File Pruning
Primary Actor: Developer
Secondary Actor: Neural Pruner Model

Use Cases:
1. Estimate Carbon (Before): Call POST /estimate-carbon with original token count.
2. Format Instruction Input: Prepend ChatML system prefix and instruction template.
3. Estimate Token Budget: Check if code fits in the 8192-token window.
4. Chunk and Process: Split code into overlapping chunks if needed.
5. Merge Token Scores: Average scores for overlapping positions across chunks.
6. Aggregate to Lines: Map token score averages to line numbers via character offsets.
7. Threshold and Prune: Keep lines above threshold; insert (filtered N lines) markers.
8. Estimate Carbon (After): Call POST /estimate-carbon with pruned token count.
9. Compute Savings: Subtract after from before for each energy and CO2 metric.
10. Render Webview: Display stats, code diff, and carbon impact section.
```

*Figure 5: Single-File Pruning Use Case Diagram*

**Step-by-step description:**
1. PruneService.estimateCarbon() calls the /estimate-carbon endpoint with the original token count.
2. build_input_for_llm() prepends the ChatML system message, instruction, and query; appends the assistant think prefix.
3. estimate_token_count() checks whether code tokens exceed available_length = 8192 - prefix_tokens - suffix_tokens - query_tokens.
4. split_code_into_chunks() uses the tokenizer's offset_mapping to split at exact token boundaries with 50-token overlap.
5. merge_token_scores_from_chunks() groups token scores by (abs_start, abs_end) character position and averages scores.
6. aggregate_token_scores_to_lines() maps character ranges to 1-indexed source lines.
7. prune_code_lines() applies the threshold, adds single-gap exceptions, and inserts (filtered N lines) markers.
8-9. Same estimation call with pruned token count; difference computed client-side.
10. ResultPanel.show() renders the full result HTML.

#### Level 1.4: Carbon Estimation Module

```
Name: Carbon Estimation
Primary Actor: Developer
Secondary Actors: Model Registry (system), Regressor Artifacts (system)

Use Cases:
1. Receive Estimation Request: Accept token counts, model name, hardware params.
2. Resolve Model Features: Look up model registry for size, MMLU-Pro, BBH, GPU type.
3. Encode GPU Type: Map GPU name string to integer index via feature_artifacts.json.
4. Route to Regressor: <=111B -> XGBoost interpolation; >111B -> Ridge extrapolation.
5. Assemble Feature Row: Build 8-feature DataFrame matching FEATURE_COLUMNS schema.
6. Predict Phase Energies: Regressor outputs prefill Joules and decode Joules.
7. Scale Token Counts: Scale predictions from benchmark baseline (256/128) to actual counts.
8. Compute CO2: Convert total Joules to gCO2 using carbon grid intensity.
9. Return Response: Prefill Joules, decode Joules, CO2 grams, routes, feature source.
```

*Figure 6: Carbon Estimation Use Case Diagram*

---

### 3.2 Activity Diagram

#### Level 1: End-to-End Workspace Pruning Workflow

```
[Developer triggers "Build Repository Context"]
        |
        v
[Extension shows query input box]
        |
        v
[Developer enters query]
        |
        v
[Extension collects editor state: active file, selection, symbol, diagnostics]
        |
        v
[Extension sends POST /prune-workspace with full payload]
        |
        v
[Backend: GoalCompiler.compile()]
        |
    [Local LLM available?]
   YES /           \ NO
      v              v
[Call Qwen2.5-Coder] [INTENT_TEMPLATES fallback]
      |              |
       \            /
        v
[Post-process identifiers (filter hallucinations)]
        |
        v
[RepositoryIndex.build_index() - traverse and parse all .py files]
        |
        v
[DependencyGraph.build_graph() - resolve imports + calls into edges]
        |
        v
[LexicalRetriever.search_identifiers() -> seed file set]
        |
        v
[GraphRetriever.get_neighbors() BFS -> distance map]
        |
        v
[Filter candidates: active file OR matched identifier]
        |
        v
[CandidateRanker.rank_candidates() -> sorted (path, score) list]
        |
        v
[ContextBuilder.pack_context()]
        |
     [For each file:]
        |
     [Distance 0?] ---YES---> [Tier 1: prune(threshold - 0.15)]
        |
     [Distance 1 AND score > -2.0?] ---YES---> [Tier 2: prune(threshold + 0.15)]
        |
     [Else] ----> [Tier 3: generate AST signature stubs]
        |
        v
[Assemble unified_prompt + file_summaries]
        |
        v
[Return WorkspacePruneResponse]
        |
        v
[ResultPanel.showWorkspaceResult() - render Webview]
        |
        v
[Developer clicks "Copy Unified Context" or "Insert At Cursor"]
```

*Figure 7: Activity Diagram - End-to-End Workspace Pruning Workflow*

#### Level 1.1: Goal Synthesis Activity

```
[Receive query + editor evidence]
        |
        v
[Is query vague AND no editor evidence?]
   YES |              | NO
       v              v
[Return StructuredGoal  [Build ChatML synthesis prompt]
 with clarification=true]       |
                                v
                        [POST to Qwen2.5-Coder]
                                |
                        [HTTP 200 + valid JSON?]
                       YES /           \ NO / Timeout
                          v              v
                [Deserialize        [deterministic_fallback()]
                 StructuredGoal]         |
                          |              |
                           \            /
                            v
                [Filter identifiers: remove any not in
                 query, selected_code, symbol, diagnostics]
                            |
                            v
                [Return validated StructuredGoal]
```

*Figure 8: Activity Diagram - Goal Synthesis*

#### Level 1.2: Neural Line Skimming Activity

```
[Receive PruneRequest: query, code, threshold]
        |
        v
[Tokenize query+code -> estimate token counts]
        |
        v
[code_tokens > available_window?]
   YES /                   \ NO
      v                     v
[split_code_into_chunks()]  [_process_single_chunk()]
[For each chunk:                       |
  _process_single_chunk()              |
  -> chunk_score, token_scores]        |
[merge_token_scores_from_chunks()      |
 -> average scores at abs positions]   |
      |                                |
       \                              /
        v
[aggregate_token_scores_to_lines()
 -> {line_num: mean_score} dict]
        |
        v
[prune_code_lines(threshold):
 - Keep line if score >= threshold
 - Preserve single-gap lines
 - Insert "(filtered N lines)" markers]
        |
        v
[Return PruneResponse: score, pruned_code,
 token_scores, kept_frags, origin_token_cnt,
 left_token_cnt, model_input_token_cnt]
```

*Figure 9: Activity Diagram - Neural Line Skimming*

#### Level 1.3: Carbon Estimation Activity

```
[Receive CarbonEstimateRequest]
        |
        v
[CarbonEstimator._resolve_model_features():
 Check request fields -> fill from model_registry.json -> fill from defaults]
        |
        v
[Encode GPU type -> integer via gpu_encoder]
        |
        v
[DualModeRegressorEngine.predict():
 model_size_b <= 111.0?]
   YES /                \ NO
      v                  v
[XGBoost interpolation]  [Ridge extrapolation]
[prefill = xgb_prefill   [prefill = ridge_prefill
           .predict()]              .predict()]
[decode  = xgb_decode    [decode  = ridge_decode
           .predict()]              .predict()]
      |                  |
       \               /
        v
[Scale: prefill * (n_input/256), decode * (n_output/128)]
        |
        v
[total_joules = prefill + decode]
        |
        v
[co2_grams = (total_joules / 3_600_000) * carbon_intensity]
        |
        v
[Artifact failure?] --YES--> [Fallback: MODEL_CONSTANTS * latency_scale]
        |
        v
[Return CarbonEstimateResponse]
```

*Figure 10: Activity Diagram - Carbon Estimation*

---

## 4. Dataset Description

### 4.1 Modeling Approach

TokenWise's carbon estimation subsystem is grounded in two distinct data assets: the SEAL benchmark dataset used to train the dual-regressor energy models, and the neural pruner checkpoint ayanami-kitasan/code-pruner from HuggingFace Hub. This section documents both assets in detail, with particular focus on the SEAL dataset, which drives the carbon estimation subsystem and is the primary managed data artifact of this project.

### 4.2 Carbon Estimation Dataset Overview

The carbon estimation engine is built upon the benchmark data released with the SEAL paper ("Sustainable and Efficient LLM Serving: A Survey and Practice", 2025). The SEAL dataset provides measured hardware energy and latency profiles for a diverse collection of LLMs across different GPU configurations, enabling non-intrusive, execution-free energy estimation purely from a token count and model metadata.

| Property | Description |
|---|---|
| Dataset name | SEAL Benchmark Energy Dataset |
| Source study | Sustainable and Efficient LLM Serving: A Survey and Practice (2025) |
| Domain | LLM inference energy measurement, hardware profiling |
| Data type | Tabular numerical (GPU measurements, benchmark scores, model metadata) |
| Purpose in TokenWise | Training data for XGBoost and Ridge phase-specific energy regressors |
| LLMs covered | ~36 models ranging from DistilGPT-2 (0.1B) to Falcon-180B (180B) |
| GPU configurations | NVIDIA A10G, A100-40GB, A100-80GB |

### 4.3 Data Source and Collection

The SEAL dataset was constructed through the following pipeline in the source study:

1. **Model Selection:** The study benchmarked a diverse set of open-weight LLMs spanning multiple families (GPT, LLaMA, Mistral, Falcon, Gemma, DeciLM, Phi) and parameter scales from sub-1B to 180B.
2. **Inference Profiling:** Each model was hosted on each available GPU configuration and queried with standardized prompt lengths (256 input tokens / 128 output tokens). GPU power draw was sampled during inference to compute per-token energy consumption in Joules for both the prefill and decode phases separately.
3. **Benchmark Score Collection:** For each model, publicly available benchmark scores were collected from the Open LLM Leaderboard and model cards, including MMLU-Pro (a multiple-choice reasoning benchmark covering 57 academic domains) and BIG-Bench Hard (BBH, a suite of 23 challenging reasoning tasks).
4. **Feature Matrix Construction:** The measured latency and energy values were combined with benchmark scores, model size, and GPU type into a unified tabular feature matrix.

### 4.4 Dataset Composition

| Subset | Description |
|---|---|
| Training models (interpolation) | ~30 LLMs with parameter counts <=111B for XGBoost regressors |
| Training models (extrapolation) | ~6 LLMs with parameter counts >111B for Ridge regressors |
| model_registry.json entries | 36 named model entries stored in the artifact registry |
| Regressor artifacts produced | 4 files: xgb_prefill, xgb_decode, ridge_prefill, ridge_decode |
| Validation artifacts | cv_metrics.json (cross-validation RMSE), validation_report.json |

### 4.5 Record Structure

Each raw record in the SEAL dataset used for training is defined by the following feature tuple:

| Feature | Field | Type | Description |
|---|---|---|---|
| F1 | n_input_tokens | integer | Number of input tokens (benchmark baseline: 256) |
| F2 | n_output_tokens | integer | Number of output tokens (benchmark baseline: 128) |
| F3 | model_size_b | float | Model parameter count in billions |
| F4 | latency_per_input_token_ms | float | Measured milliseconds per input token during prefill |
| F5 | latency_per_output_token_ms | float | Measured milliseconds per output token during decode |
| F6 | gpu_encoded | integer | Integer encoding of the GPU type (from feature_artifacts.json) |
| F7 | mmlu_pro_score | float | MMLU-Pro benchmark score (0-1 normalized) |
| F8 | bbh_score | float | BIG-Bench Hard score (0-1 normalized) |

Regression targets:
- prefill_joules: measured energy in Joules for the prefill phase at baseline token counts
- decode_joules: measured energy in Joules for the decode phase at baseline token counts

### 4.6 Data Preprocessing

Before training the regressors, the following preprocessing steps are applied:

- **GPU Encoding:** The GPU type string (e.g., "nvidia-a100-80gb") is mapped to a non-negative integer via an ordinal encoder. The mapping is persisted in feature_artifacts.json under the gpu_encoder key, enabling the same encoding at inference time.
- **Feature Selection:** Only the 8 columns in FEATURE_COLUMNS are used. No additional normalization or standardization is applied to the XGBoost models (which are scale-invariant by construction). Ridge regression uses the raw feature values.
- **Regime Splitting:** The dataset is split into an interpolation subset (model_size_b <= 111.0) and an extrapolation subset (model_size_b > 111.0). Each subset trains two regressors: one for prefill energy and one for decode energy.
- **Cross-Validation Metrics:** k-fold cross-validation is used on the interpolation subset to estimate out-of-sample RMSE. Results are stored in cv_metrics.json.

### 4.7 Feature Engineering

The feature matrix design follows the SEAL paper's recommendation to combine both intrinsic model properties (size, quality scores) and deployment-specific hardware measurements (GPU type, latency):

- **MMLU-Pro and BBH scores** capture model quality / capability, which correlates with architectural complexity and thus energy draw at a given parameter count.
- **Latency fields** provide direct proxy measurements of the hardware and deployment configuration, accounting for variations in quantization, batch size, and CUDA kernel efficiency.
- **GPU-encoded type** captures the hardware tier (A10G < A100-40GB < A100-80GB) which determines the physical power draw ceiling.
- **Token count fields** serve as scaling anchors at training time (all measurements are at the 256-input / 128-output baseline). At inference time, predictions are scaled linearly by the ratio of actual to baseline token counts.

### 4.8 Model Training and Artifact Storage

The carbon engine training pipeline is located in carbon-engine/src/carbon_engine/:

| Module | Responsibility |
|---|---|
| schema.py | Pydantic schemas for the raw SEAL data records and feature rows |
| registry.py | Loading and parsing the SEAL dataset; building the model registry JSON |
| features.py | Feature extraction from raw records into the 8-column FEATURE_COLUMNS format |
| modeling.py | Training the XGBoost and Ridge regressors; computing CV metrics |
| inference.py | Loading trained artifacts and running predictions (mirrors the production engine) |
| merge.py | Merging multiple dataset shards |
| io_utils.py | File I/O helpers for JSON and pickle artifacts |
| config.py | Training configuration: interpolation size threshold, CV folds, XGBoost hyperparameters |

The training pipeline produces the following artifacts in carbon_artifacts/:

| Artifact | Format | Description |
|---|---|---|
| xgb_prefill_interpolation.json | XGBoost JSON | XGBoost regressor for prefill energy on models <=111B |
| xgb_decode_interpolation.json | XGBoost JSON | XGBoost regressor for decode energy on models <=111B |
| ridge_prefill_extrapolation.pkl | joblib pickle | Ridge regressor for prefill energy on models >111B |
| ridge_decode_extrapolation.pkl | joblib pickle | Ridge regressor for decode energy on models >111B |
| feature_artifacts.json | JSON | GPU type encoder mapping |
| model_registry.json | JSON | Per-model metadata (size, scores, latency, GPU) for 36 LLMs |
| cv_metrics.json | JSON | Cross-validation RMSE for interpolation regressors |
| validation_report.json | JSON | Hold-out validation metrics |

### 4.9 Data Usage in the System

The artifacts are consumed by the production system as follows:

1. At server startup, CarbonEstimator.__init__() loads feature_artifacts.json (GPU encoder) and model_registry.json (model metadata registry), and DualModeRegressorEngine.__init__() loads the four regressor artifacts.
2. On each /estimate-carbon request, _resolve_model_features() looks up the model name in the registry to fill any missing fields.
3. _encode_gpu() maps the GPU type string to its integer encoding using the persisted encoder.
4. DualModeRegressorEngine.predict() selects the correct pair of regressors based on model size, assembles the 8-feature DataFrame, and calls predict() on both the prefill and decode regressors.
5. The raw predictions (trained on 256-input / 128-output benchmarks) are scaled to the actual token counts before returning.
6. If any artifact is missing, the system falls back to MODEL_CONSTANTS lookup and latency-scaled estimation, maintaining endpoint availability at all times.

### 4.10 Neural Skimmer Model Data

The line-level neural skimmer uses a pre-trained fine-tuned checkpoint:

| Property | Value |
|---|---|
| Base model | Qwen3-Reranker-0.6B |
| Fine-tuned checkpoint | ayanami-kitasan/code-pruner (HuggingFace Hub) |
| Training task | Token-level relevance labeling: keep (1) or prune (0) per code token relative to a natural-language query |
| Added components | Multi-head attention fusion layers, FFN/simple/CRF compression head |
| Tokenizer | Qwen3 tokenizer (ChatML format), left-padding for LLM-style models |
| Input format | ChatML template with instruction, query, and code document |
| Output | token_logits [1, L] per-token keep probability logits; score_logits [1] document-level yes/no log probability |
| Model file | config.json + model.safetensors in local ./model directory |

The system does not manage any training data for the neural skimmer model. The model.safetensors checkpoint is treated as a fixed artifact downloaded from HuggingFace Hub at deployment time using SwePrunerForCodePruning.from_pretrained().

---

## 5. Preliminary Test Plan

### 5.1 Testing Objectives

The objective of this preliminary test plan is to verify that TokenWise performs its intended functions correctly and reliably. Specifically, testing aims to:

- Verify that each API endpoint (/health, /prune, /prune-workspace, /estimate-carbon) produces correct, schema-conformant output for its defined inputs.
- Confirm that the goal synthesis produces non-hallucinated identifiers and falls back deterministically when the LLM is unavailable.
- Validate that the neural pruner correctly splits large files into chunks, merges overlapping token scores, and produces syntactically coherent pruned output with accurate (filtered N lines) markers.
- Ensure that the three-tier context assembly applies the correct pruning strategy per tier and that Tier 3 files produce valid class/function signature stubs.
- Verify that the carbon estimator correctly routes requests between XGBoost and Ridge regressors based on model size, scales predictions by the actual token ratio, and falls back gracefully when artifacts are missing.
- Confirm that the VS Code extension commands correctly collect all editor state, construct the request payload, and display results without crashing or XSS vulnerabilities.
- Validate that the cumulative CO2 savings status bar item updates correctly after each pruning session.

### 5.2 Features to be Tested

| Test Case ID | Title | Test Scenario | Expected Outcome |
|---|---|---|---|
| T1 | Backend Health Check | Start server with valid model path. Call GET /health. Also test with missing model. | Loaded model returns status: healthy, model_loaded: true. Missing model returns model_loaded: false without crashing. |
| T2 | Goal Synthesis - LLM Path | Call POST /prune-workspace with a specific query and editor evidence containing named identifiers, while mock LLM server is running. | structured_goal.identifiers contains only identifiers present in the submitted query, selected code, symbol, and diagnostics. No hallucinated names appear. |
| T3 | Goal Synthesis - Fallback Path | Call POST /prune-workspace with local_llm_url pointing to an unavailable address. Use a query beginning with "fix". | structured_goal.task_type equals bug_fix. objective matches the fix INTENT_TEMPLATE. System completes without error. |
| T4 | Vague Query Handling | Call POST /prune-workspace with query = "fix" and no selected code, no current symbol, no diagnostics. | structured_goal.clarification_required equals true. System returns a valid response without attempting retrieval. |
| T5 | Single-File Pruning - Small Code | Submit a 20-line Python function via POST /prune with threshold 0.5. Inspect kept fragments and pruned code. | pruned_code is shorter than the original. kept_frags contains only retained line numbers. (filtered N lines) markers are syntactically valid. |
| T6 | Large File Chunking | Submit a code file with more than 7,500 tokens via POST /prune. | Server does not crash. Response includes pruned_code with valid markers. origin_token_cnt reflects the full file. Token scores are merged correctly across chunks. |
| T7 | Single-Gap Preservation | Submit code where two kept lines have exactly one non-kept line between them. | The intermediate line appears in kept_frags and in pruned_code rather than being replaced by a (filtered 1 lines) marker. |
| T8 | AST Repository Indexing | Point workspace root at Test_project directory. Call POST /prune-workspace. | files list in response includes entries for all .py files in Test_project. Each entry includes a valid tier and relation field. |
| T9 | Dependency Graph Seed Expansion | Use a query referencing an identifier defined in file B, imported by the active file A. | File B appears in the files response with distance 1 (Tier 2). The graph correctly resolves the import edge. |
| T10 | Tier-3 Signature Stub Generation | Include a file in the workspace with no direct import relationship to the active file (distance >= 2). | The file appears with tier: 3. Its contribution to unified_prompt contains only class X: and def method(self, ...): ... stubs, not function bodies. |
| T11 | Carbon Estimation - XGBoost Route | Call POST /estimate-carbon with model_name = "llama-3-70b" (70B <= 111B). | Response includes prefill_route: xgboost_interpolation. prefill_joules and decode_joules are positive. |
| T12 | Carbon Estimation - Ridge Route | Call POST /estimate-carbon with a model name mapping to model_size_b > 111.0 (e.g., falcon-180b). | Response includes prefill_route: ridge_extrapolation. Values are positive and reflect the scaling ratio. |
| T13 | Carbon Estimation - Missing Artifacts Fallback | Remove artifact files from carbon_artifacts/. Call POST /estimate-carbon. | Response returns valid positive energy and CO2 values with features_source: fallback_constants. Endpoint does not return an error. |
| T14 | Carbon Token Scaling | Call with input_tokens = 512 for a model trained on 256-token baseline. Compare with input_tokens = 256. | The 512-token response prefill_joules is approximately 2x the 256-token response, confirming linear scaling by n_input / 256. |
| T15 | VS Code Prune Selected Command | Select a block of Python code in the editor. Invoke TokenWise: Prune Selected Code. Enter a query. | Webview opens beside the editor. Query label matches entered text. pruned_code differs from originalCode. Token reduction percent is positive. No JavaScript errors in Webview. |
| T16 | VS Code Build Repository Context Command | Open a Python workspace. Invoke TokenWise: Build Repository Context. Enter a query. | Webview opens showing the synthesized goal card, file table with tier assignments, and unified prompt. Copy Unified Context button copies the prompt to clipboard. |
| T17 | Carbon Status Bar Update | Invoke TokenWise: Prune Current File once successfully. | Status bar text changes from $(filter) TokenWise to $(leaf) TokenWise X.XXXXXXg saved. The numeric value is non-zero. |
| T18 | Webview XSS Safety | Insert an XSS payload into a Python file (e.g., a comment containing a script tag). Prune the file. | The Webview renders the script tag as escaped text. No JavaScript alert fires. |
| T19 | Identifier Hallucination Prevention | Submit a query "fix bug" with selected_code = empty, no diagnostics, and current symbol = "myFunc". | identifiers in the structured goal contains only tokens from "fix bug" and "myFunc". The LLM cannot introduce class or function names not present in the evidence. |
| T20 | Extension Graceful Degradation (Server Down) | Stop the backend server. Invoke any pruning command. | Extension shows an error notification message. VS Code does not crash. No unhandled promise rejection is logged to the developer tools console. |

---

## 6. Timeline

The estimated timeline for the full TokenWise project is presented below:

| Phase | Activities | Estimated Duration |
|---|---|---|
| Phase 1: Research and Design | Review SWE-pruner paper, SEAL paper, and Qwen3-Reranker architecture. Define system architecture, API contract, and data schemas. | 3 weeks |
| Phase 2: Backend Foundation | Implement online_serving.py, SwePrunerForCodeCompression, model loading, /health and /prune endpoints. Resolve Windows CPU threading issues. | 3 weeks |
| Phase 3: Carbon Engine | Implement SEAL feature engineering pipeline, train XGBoost and Ridge regressors on the SEAL dataset, persist artifacts, implement DualModeRegressorEngine and CarbonEstimator, add /estimate-carbon endpoint. | 4 weeks |
| Phase 4: Goal Synthesis and Retrieval | Implement GoalCompiler, LocalGoalGeneratorClient, PythonASTIndexer, RepositoryIndex, DependencyGraph, LexicalRetriever, GraphRetriever, CandidateRanker, and ContextBuilder. Add /prune-workspace endpoint. | 4 weeks |
| Phase 5: VS Code Extension | Implement TypeScript extension with four commands, ResultPanel Webview with two rendering modes, PruneService, TokenWiseApiClient, status bar item, and workspace configuration. | 3 weeks |
| Phase 6: Integration Testing | End-to-end testing with Test_project, extension test sessions, manual test documentation, bug fixes. | 2 weeks |
| Phase 7: Documentation | Write SRS, SEAL implementation progress notes, README, extension test reports. | 1 week |
| **Total** | | **~20 weeks** |
