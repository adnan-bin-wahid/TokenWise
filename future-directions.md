# Future Directions: Best User-Friendly VS Code Extension for SWE-Pruner

## 1) Product Goal

Create a VS Code extension that feels effortless for developers and reliably reduces irrelevant context before using AI tools.

Primary value:

- Reduce token usage without hurting answer quality
- Improve AI response speed
- Keep developers inside their normal editor workflow

Proposed name:

- TokenWise (powered by SWE-Pruner)

## 2) User Promise

In less than 10 seconds, a user should be able to prune code for a task and immediately use the result with Copilot chat, Codex workflows, or other AI assistants.

The extension is successful only if it is:

- Fast
- Predictable
- Safe
- Clear about what it changed

## 3) User Personas and Needs

### Persona A: Daily app developer

Needs quick pruning for bug fixes and feature work.

### Persona B: Team lead/reviewer

Needs consistent context quality across team prompts.

### Persona C: Cost-conscious user

Needs visible token/cost savings and confidence that quality is maintained.

## 4) UX Principles (Non-Negotiable)

1. One-click first experience.
2. No setup required for local mode.
3. Every action shows clear benefit (before vs after tokens).
4. Always reversible (easy fallback to original code).
5. No noisy UI, no hidden destructive actions.

## 5) Ideal User Journey

1. Install extension from Marketplace.
2. Open file or highlight code.
3. Click "Prune Context for Task" (command or right-click).
4. Enter short task goal (for example: "find auth/session logic").
5. See side-by-side result:

- Original context
- Pruned context
- Reduction stats and confidence signals

6. Click one of:

- Copy pruned context
- Insert pruned context
- Send to AI chat prompt helper

7. If unhappy, click "Restore Original".

## 6) MVP Scope (Must-Have)

### Commands

- TokenWise: Prune Selected Code
- TokenWise: Prune Current File
- TokenWise: Prune Open Files (Top N)
- TokenWise: Restore Original Context

### UI Components

- Command palette integration
- Editor context-menu action
- Results webview with split layout
- Status bar indicator (Ready, Pruning, Error)

### Output Details

- Query used
- Score
- Original token count
- Pruned token count
- Estimated reduction percent
- Kept fragment line ranges

### Settings

- `tokenWise.apiUrl`
- `tokenWise.timeoutMs`
- `tokenWise.defaultThreshold`
- `tokenWise.mode` (`local` or `remote`)
- `tokenWise.maxCharsPerRequest`

## 7) Integration Strategy

### Copilot workflow integration

- Provide "Copy for Copilot Chat" action.
- Provide "Prepare Prompt Context" command that places pruned context in a new scratch editor.
- Use supported VS Code extension APIs only.

### Codex workflow integration

- Provide reusable pruned payload in JSON/text format.
- Optional: direct call bridge for users with their own model endpoint.

### Important note

Deep internal control of proprietary assistant internals may be limited; design around stable public extension APIs and user-visible workflows.

## 8) Reliability and Performance Standards

- First UI response after command: under 300 ms.
- Health-check on activation: under 1 s.
- Typical prune request (small file): under 10 s on local CPU.
- Clear timeout message with actionable retry hints.
- Never freeze editor thread.

## 9) Trust, Privacy, and Safety

- Local mode by default.
- Do not store source code by default.
- Redact code from logs unless explicit debug mode is enabled.
- Show privacy mode in UI (Local or Remote) at all times.
- Require HTTPS for remote mode.

## 10) Error UX Design

For each common failure, show a fix button and short message:

1. Backend unreachable

- Message: "Cannot reach SWE-Pruner service."
- Action: "Open setup guide"

2. Timeout

- Message: "Prune request timed out."
- Actions: "Retry with smaller selection" and "Increase timeout"

3. Invalid payload

- Message: "Request formatting issue."
- Action: "Show request preview"

4. Version mismatch

- Message: "Extension/backend compatibility mismatch."
- Action: "Run compatibility check"

## 11) Roadmap

### Phase 1 (Week 1-2): Usable MVP

- Build commands and settings
- Connect to `/health` and `/prune`
- Render result webview
- Add copy/insert/restore actions

### Phase 2 (Week 3-4): Delight and Clarity

- Line highlighting and relevance legend
- "Before vs After" summary cards
- Better command discoverability and walkthrough
- Keyboard shortcuts for top actions

### Phase 3 (Week 5-8): Team and Scale

- Remote hosted mode with API key
- Team presets (debug/refactor/security)
- Usage dashboard (token saved, time saved)
- Marketplace polish and onboarding docs

## 12) Validation Plan (Prove It Helps)

Run a 2-week beta with 10-20 users and track:

- Median token reduction
- Task success after pruning
- Median latency
- Repeat usage rate (weekly active users)
- User satisfaction score (quick thumbs up/down)

Success gate to continue:

- > =25% median token reduction
- > =90% prune requests without errors
- > =60% users returning weekly

## 13) Adoption Strategy

1. Launch with "works in 1 minute" setup.
2. Provide one-click demo command and sample task.
3. Show immediate proof of value on first run.
4. Offer conservative default mode to avoid over-pruning.
5. Keep advanced controls optional, not forced.

## 14) Future Advanced Features

- Multi-file relevance ranking before prune
- Workspace semantic map
- Language-specific prompt presets
- Team governance and policy mode
- Enterprise SSO and audit controls

## 15) Final Product Standard

The extension should feel invisible when it works: one action, clear output, measurable token savings, and no disruption to normal coding flow.

If those conditions hold, users will not just try it, they will keep using it.

## 16) SEAL Framework Implementation (Full Step-by-Step)

This section defines exactly how TokenWise should implement the paper's complex carbon-estimation approach end-to-end, including data fusion, prompt-level estimation, phase-specific modeling, and dual-regressor routing.

### 16.1 Scope and Goal

Implement a production carbon estimation pipeline that:

- Works at prompt level for every prune action
- Uses non-intrusive features only
- Separates Prefill and Decode energy prediction
- Uses XGBoost for interpolation and Ridge for extrapolation
- Reports user-visible savings in Joules and gCO2eq

### 16.2 Required Inputs and Definitions

For each estimation request, construct this feature set:

1. Input tokens (`n_input_tokens`)
2. Output tokens (`n_output_tokens`)
3. Model size in billions (`model_size_b`)
4. Latency per input token (`latency_per_input_token_ms`)
5. Latency per output token (`latency_per_output_token_ms`)
6. GPU type encoded (`gpu_encoded`)
7. Model quality metrics from Open LLM benchmark (`mmlu_pro_score`, `bbh_score`)

Targets to predict:

- `prefill_energy_j`
- `decode_energy_j`

Then compute:

- `total_energy_j = prefill_energy_j + decode_energy_j`
- `co2_grams` using region-specific carbon intensity

### 16.3 Architecture Components

Build these components in this order:

1. Data Fusion Pipeline
2. Feature Engineering Pipeline
3. Model Training Pipeline (4 models total)
4. Inference Router (Interpolation vs Extrapolation)
5. Backend API endpoint (`/estimate-carbon`)
6. VS Code extension integration
7. Validation and release gates

### 16.4 Phase A: Multi-Benchmark Feature Fusion

#### Step A1: Ingest LLM-Perf Leaderboard data

- Source energy and latency features from LLM-Perf dataset.
- Preserve model id, precision, token counts, prefill/decode latency, and prefill/decode energy.
- Normalize model naming and precision naming.

#### Step A2: Ingest Open LLM Leaderboard data

- Source quality features such as MMLU-Pro and BBH.
- Preserve model id, precision, model size, and quality metrics.
- Normalize model naming and precision naming using the same canonical rules as A1.

#### Step A3: Merge datasets

- Join key: (`model_name`, `precision`).
- Merge strategy: strict inner join for training-quality rows.
- Store merged dataset as the canonical SEAL training dataset.

#### Step A4: Quality checks on merged data

- Remove duplicate rows by (`model_name`, `precision`, token profile).
- Drop rows with missing critical fields (features or energy targets).
- Track data retention rate and log removed row counts by reason.

### 16.5 Phase B: Feature Engineering

#### Step B1: Token features

- Keep `n_input_tokens` and `n_output_tokens` as separate raw features.
- Avoid combining into one total-token feature because phase models rely on directional behavior.

#### Step B2: Latency features

- Keep both `latency_per_input_token_ms` and `latency_per_output_token_ms`.
- Validate positive finite values only.

#### Step B3: Model and hardware features

- Keep `model_size_b` as numeric.
- Encode `gpu_type` using a persisted encoder artifact so inference uses identical mapping.

#### Step B4: Quality features

- Keep both `mmlu_pro_score` and `bbh_score`.
- Standardize scales if needed, but keep deterministic transform artifacts.

#### Step B5: Persist preprocessing artifacts

- Save GPU encoder mapping.
- Save any scaler/normalizer objects.
- Version artifacts with a schema id so extension/backend compatibility is explicit.

### 16.6 Phase C: Phase-Specific Modeling

Train separate models for each inference phase and each generalization mode.

Total models required:

1. Prefill-Interpolation (XGBoost)
2. Decode-Interpolation (XGBoost)
3. Prefill-Extrapolation (Ridge)
4. Decode-Extrapolation (Ridge)

#### Step C1: Build interpolation training split

- Include rows where `model_size_b` is within known training range (for example, 7B to 70B, or your dataset's bounded known interval).

#### Step C2: Build extrapolation training split

- Include rows designed for out-of-range behavior (frontier large models).
- Keep strict separation from interpolation validation folds.

#### Step C3: Train XGBoost regressors for interpolation

- Train one model for `prefill_energy_j`.
- Train one model for `decode_energy_j`.
- Tune depth, learning rate, estimators, and regularization via cross-validation.

#### Step C4: Train Ridge regressors for extrapolation

- Train one model for `prefill_energy_j`.
- Train one model for `decode_energy_j`.
- Tune alpha using cross-validation focused on extrapolation behavior stability.

#### Step C5: Evaluate and compare

For each of the 4 models, report:

- MAPE
- MAE
- RMSE
- R2

Keep per-phase scorecards and confidence intervals.

### 16.7 Phase D: Dual-Mode Regressor Router

#### Step D1: Routing policy

- If requested `model_size_b` is inside interpolation range, use XGBoost model for that phase.
- If outside interpolation range, use Ridge model for that phase.

#### Step D2: Route independently per phase

- Run routing separately for Prefill and Decode predictions.
- Do not force both phases through one model class unless policy explicitly demands it.

#### Step D3: Return transparent metadata

Include in API response:

- `prefill_regressor_used`
- `decode_regressor_used`
- `interpolation_range`
- `feature_schema_version`

### 16.8 Phase E: Prompt-Level Carbon Estimation API

#### Step E1: Add backend endpoint

Create endpoint in swe-pruner backend:

- Path: `/estimate-carbon`
- Method: POST
- Input: feature payload for one prompt
- Output: phase energies, total energy, carbon result, model-route metadata

#### Step E2: Carbon conversion

Use regional carbon intensity table:

- `co2_grams = (total_energy_j / 3_600_000) * carbon_intensity_g_per_kwh`

Where:

- `3_600_000` converts Joules to kWh denominator units
- `carbon_intensity_g_per_kwh` comes from configured region

#### Step E3: Region handling

- Default region to global average if unknown.
- Return both region key and intensity value in response.

### 16.9 Phase F: TokenWise Extension Integration

#### Step F1: Token counting before and after prune

- Compute original input token count from editor text.
- Compute pruned input token count from prune result.
- Keep output token assumption configurable.

#### Step F2: Trigger carbon estimation twice

1. Estimate baseline (before pruning)
2. Estimate pruned (after pruning)

Then compute delta:

- `joules_saved`
- `co2_grams_saved`
- `prefill_joules_saved`
- `decode_joules_saved`

#### Step F3: Result panel UX

Add a dedicated Carbon Impact section showing:

- Tokens before/after
- Reduction percent
- Prefill/Decode savings
- Total Joules saved
- CO2 grams avoided
- Region used
- Regressor route used

#### Step F4: Extension settings

Add configuration keys:

- `tokenWise.targetModelName`
- `tokenWise.targetModelSizeB`
- `tokenWise.targetGpuType`
- `tokenWise.expectedOutputTokens`
- `tokenWise.carbonIntensityRegion`
- `tokenWise.latencyPerInputTokenMs`
- `tokenWise.latencyPerOutputTokenMs`
- `tokenWise.enableCarbonEstimation`

### 16.10 Phase G: Reliability, Privacy, and Guardrails

#### Step G1: Non-intrusive operation

- Never require privileged hardware telemetry for normal operation.
- Use benchmark-derived features and user-configured assumptions.

#### Step G2: Fallback policy

- If model metadata is missing, use conservative default profile and show warning.
- If estimator is unavailable, continue pruning flow and mark carbon result as unavailable.

#### Step G3: Privacy policy alignment

- Do not persist source code for carbon analytics.
- Persist only aggregate anonymous counters when analytics is enabled.

### 16.11 Phase H: Validation and Acceptance Gates

Before shipping each release, all gates must pass.

#### Gate H1: Training quality gates

- Interpolation models must meet target low-MAPE thresholds defined by your benchmark baseline.
- Extrapolation models must beat naive baseline on frontier-size holdout set.

#### Gate H2: External empirical sanity check

- Compare predictions with at least one independent measured inference dataset.
- Report average relative error and worst-case error.

#### Gate H3: API performance gate

- `/estimate-carbon` p95 response time under target budget (for example < 200 ms local).

#### Gate H4: End-to-end extension gate

- Prune command still works if carbon service fails.
- Result panel never blocks or crashes on partial carbon data.

### 16.12 Implementation Order (Execution Checklist)

Follow this exact sequence:

1. Build dataset ingestion scripts.
2. Implement merge and validation checks.
3. Implement feature engineering artifacts.
4. Train 4 phase/mode models.
5. Implement regressor routing engine.
6. Expose `/estimate-carbon` backend endpoint.
7. Integrate extension token counting.
8. Integrate before/after carbon calls.
9. Add Carbon Impact UI card.
10. Add settings and fallback logic.
11. Run validation gates.
12. Release behind feature flag, then make default once stable.

### 16.13 Definition of Done

This SEAL integration is complete only when all conditions are true:

- Prompt-level carbon estimate is shown for every successful prune request.
- Prefill and Decode are modeled separately and reported separately.
- Router selects XGBoost or Ridge according to interpolation/extrapolation policy.
- Data pipeline uses fused benchmark features (LLM-Perf + Open LLM).
- UX clearly explains estimate source, region assumption, and uncertainty.
- Extension remains fast, safe, and reversible even when carbon estimation is degraded.
