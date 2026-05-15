# TokenWise VS Code Extension: Complete Manual Test Guide

This document explains exactly how to manually test TokenWise end-to-end and verify it is working correctly.

Scope covered:

- Backend API readiness (`/health`, `/prune`)
- Extension build and launch
- Command behavior in VS Code
- Result panel behavior
- Error handling and edge cases
- Regression sanity checks

---

## 1) Test Environment Checklist

Run these tests on a clean baseline as much as possible.

Required:

- Windows + Git Bash
- Python 3.12
- Node.js + npm
- VS Code
- SWE-Pruner model downloaded in local backend model folder

Workspace expected root:

`E:/A A SPL3/part-2/swe-pruner`

Extension folder:

`E:/A A SPL3/part-2/swe-pruner/vscode-extension`

Backend folder:

`E:/A A SPL3/part-2/swe-pruner/swe-pruner/swe-pruner`

---

## 2) Pre-Test: Backend Verification

### 2.1 Start backend

In terminal A:

```bash
cd "/e/A A SPL3/part-2/swe-pruner/swe-pruner/swe-pruner"
"/e/A A SPL3/part-2/swe-pruner/.venv/Scripts/python.exe" -m swe_pruner.online_serving --model-path ./model --port 8000
```

Expected:

- Logs show model loaded
- Uvicorn listening on `http://0.0.0.0:8000`

### 2.2 Health check

In terminal B:

```bash
curl -sS --max-time 20 http://127.0.0.1:8000/health
```

Expected response:

```json
{ "status": "healthy", "model_loaded": true }
```

Pass criteria:

- Returns JSON quickly
- `model_loaded` is `true`

### 2.3 Direct prune check (baseline before extension)

```bash
curl -sS -X POST http://127.0.0.1:8000/prune \
  -H "Content-Type: application/json" \
  -d '{
	"query": "find authentication logic",
	"code": "def login(user, pwd):\n    if user == \"admin\":\n        return True\n    return False\n",
	"threshold": 0.45
  }'
```

Expected:

- HTTP 200
- JSON with fields `score`, `pruned_code`, `origin_token_cnt`, `left_token_cnt`

Pass criteria:

- Endpoint works before testing extension UI

---

## 3) Pre-Test: Extension Build Verification

### 3.1 Install dependencies and compile

```bash
cd "/e/A A SPL3/part-2/swe-pruner/vscode-extension"
npm install
npm run compile
```

Expected:

- No TypeScript errors
- `dist/extension.js` exists

Pass criteria:

- Build completes successfully

---

## 4) Launch Extension Development Host

1. Open folder `vscode-extension` in VS Code.
2. Press `F5`.
3. A new "Extension Development Host" window opens.
4. In the host window, open any code file with sample code.

Pass criteria:

- Dev Host starts without extension activation errors
- TokenWise commands appear in Command Palette

Commands to check in palette:

- `TokenWise: Prune Selected Code`
- `TokenWise: Prune Current File`
- `TokenWise: Check Backend Health`

---

## 5) Functional Test Cases

## TC-01: Check Backend Health Command

Steps:

1. Run `TokenWise: Check Backend Health`.

Expected:

- Info notification appears
- Includes backend status and model loaded state

Pass criteria:

- No error message

---

## TC-02: Prune Selected Code

Test input code (paste into editor):

```python
def hash_password(pwd):
	return pwd + "_hash"

def login(user, pwd):
	if user == "admin" and hash_password(pwd) == "secret_hash":
		return create_session(user)
	return None

def create_session(user):
	return {"token": "abc", "user": user}

def render_homepage():
	return "welcome"
```

Steps:

1. Select all code.
2. Run `TokenWise: Prune Selected Code`.
3. Enter query: `Identify authentication and session-related logic`.
4. Enter threshold: `0.45`.

Expected:

- Progress notification shows pruning in progress
- Success notification appears with reduction percent
- TokenWise Result panel opens

Panel expected:

- score shown
- original token count shown
- pruned token count shown
- reduction percent shown
- original code pane and pruned code pane

Pass criteria:

- No crash
- Panel displays valid values
- `Copy Pruned Code` works
- `Insert At Cursor` inserts pruned code in active editor

---

## TC-03: Prune Current File (No Selection)

Steps:

1. Clear selection.
2. Run `TokenWise: Prune Current File`.
3. Enter query and threshold.

Expected:

- Same successful behavior as selected-code flow

Pass criteria:

- Full file text is pruned
- Result panel updates with current request

---

## TC-04: Prune Selected Code with Empty Selection

Steps:

1. Ensure no text selected.
2. Run `TokenWise: Prune Selected Code`.

Expected:

- Warning: select code first or use current file command

Pass criteria:

- No API call made
- User gets clear guidance

---

## TC-05: Cancel Input Prompts

Steps:

1. Run prune command.
2. Cancel query prompt.
3. Run again and cancel threshold prompt.

Expected:

- Command exits quietly
- No crash or stale progress indicator

Pass criteria:

- Safe cancellation path works

---

## TC-06: Invalid Threshold Validation

Steps:

1. Run prune command.
2. Enter threshold `abc`, then `2`, then `-1`.

Expected:

- Input validation blocks invalid values
- Accepts only numeric value in `[0,1]`

Pass criteria:

- Validation messages are correct and actionable

---

## TC-07: Backend Down Error Handling

Steps:

1. Stop backend server.
2. Run health and prune commands.

Expected:

- Error notifications indicate backend connection failure
- No unhandled exceptions in extension host

Pass criteria:

- Errors are user-friendly
- Extension remains usable after failure

---

## TC-08: Non-JSON / API Error Propagation

Steps:

1. Force backend bad response scenario (for example temporary backend issue).
2. Run prune command.

Expected:

- Error notification includes HTTP status/body context

Pass criteria:

- User sees meaningful failure cause

---

## TC-09: Settings Validation

Open VS Code settings for TokenWise and test:

- `tokenWise.apiUrl`
- `tokenWise.timeoutMs`
- `tokenWise.defaultThreshold`
- `tokenWise.autoOpenResultPanel`

Steps:

1. Change apiUrl to wrong URL and run health.
2. Restore to `http://127.0.0.1:8000` and rerun.
3. Set `autoOpenResultPanel=false` and run prune.

Expected:

- Wrong URL fails with clear error
- Correct URL works
- autoOpen disabled prevents automatic panel open

Pass criteria:

- Settings take effect immediately

---

## TC-10: Performance Sanity

Steps:

1. Run prune command 3 times on same input.
2. Observe response consistency and UI responsiveness.

Pass criteria:

- No extension freeze
- Responses complete without timeout for small/medium inputs
- Result panel remains stable across repeated calls

---

## 6) Regression Checklist (Quick)

Run this after any extension code change:

1. `npm run compile` succeeds.
2. Health command works.
3. Prune selected works.
4. Copy button works.
5. Insert button works.
6. Backend-down errors are friendly.

If all 6 pass, extension is likely safe to ship for that change.

---

## 7) Release Readiness Criteria

Mark ready when all are true:

- [ ] All TC-01 to TC-10 pass
- [ ] No unhandled errors in extension host console
- [ ] Build clean on a fresh machine
- [ ] README setup works end-to-end on fresh PC
- [ ] Manual test repeated by at least one other user

---

## 8) Known Good Commands Summary

Backend start:

```bash
cd "/e/A A SPL3/part-2/swe-pruner/swe-pruner/swe-pruner"
"/e/A A SPL3/part-2/swe-pruner/.venv/Scripts/python.exe" -m swe_pruner.online_serving --model-path ./model --port 8000
```

Extension build:

```bash
cd "/e/A A SPL3/part-2/swe-pruner/vscode-extension"
npm install
npm run compile
```

Health check:

```bash
curl -sS --max-time 20 http://127.0.0.1:8000/health
```

---

If all tests above pass, TokenWise extension is manually verified as fully usable for local SWE-Pruner workflows.
