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
