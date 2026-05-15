# TokenWise

TokenWise is a developer-friendly context optimization project powered by SWE-Pruner.
It reduces irrelevant code context before sending prompts to coding assistants.

## What You Get

- Task-aware context pruning
- Lower prompt token usage
- Faster model responses from smaller context
- Foundation for a user-friendly VS Code extension

## Repository Purpose

This repository is the TokenWise product layer:

- Product docs and roadmap
- Manual verification guide
- Extension planning and implementation direction

SWE-Pruner runtime and model-serving logic live in the SWE-Pruner repository.

## Recommended Repository Structure

For maximum maintainability, keep this split:

1. TokenWise repo: extension plus product logic
2. SWE-Pruner fork repo: upstream-related runtime patches only
3. Optional submodule pinning for reproducible versions

## Prerequisites (Fresh PC)

Install these first:

- Git
- Python 3.12
- pip
- Hugging Face CLI (command: hf)
- VS Code (optional but recommended)

Quick checks:

    git --version
    python --version
    pip --version
    hf --help

Expected Python: 3.12.x

## Fresh Setup: Full Local Run

These steps assume Windows plus Git Bash.

### 1) Clone TokenWise

    git clone https://github.com/adnan-bin-wahid/TokenWise.git
    cd TokenWise

### 2) Clone SWE-Pruner fork into workspace

If the folder does not exist yet:

    git clone https://github.com/adnan-bin-wahid/swe-pruner.git swe-pruner

### 3) Enter SWE-Pruner runtime directory

    cd swe-pruner/swe-pruner

### 4) Create virtual environment

Create venv at TokenWise root:

    python -m venv ../../.venv

Activate in Git Bash:

    source ../../.venv/Scripts/activate

Verify:

    python --version

### 5) Install runtime dependencies

    pip install --upgrade pip
    pip install torch
    pip install -e .

### 6) Download SWE-Pruner model files

    hf download ayanami-kitasan/code-pruner --local-dir ./model

Verify downloaded files:

    ls -lh ./model

Expected: model.safetensors around 1.3 GB plus tokenizer/config files.

### 7) Start backend API server

    python -m swe_pruner.online_serving --model-path ./model --port 8000

Leave this terminal running.

### 8) Health check from another terminal

    curl -sS --max-time 20 http://127.0.0.1:8000/health

Expected response:

    {"status":"healthy","model_loaded":true}

### 9) End-to-end prune test

    curl -sS -X POST http://127.0.0.1:8000/prune \
      -H "Content-Type: application/json" \
      -d '{
    	"query": "Identify authentication and session-related logic",
    	"code": "def hash_password(pwd):\n    return pwd + \"_hash\"\n\ndef login(user, pwd):\n    if user == \"admin\" and hash_password(pwd) == \"secret_hash\":\n        return create_session(user)\n    return None\n\ndef create_session(user):\n    return {\"token\": \"abc\", \"user\": user}\n\ndef render_homepage():\n    return \"welcome\"\n",
    	"threshold": 0.45
      }'

Expected: JSON response containing score, pruned_code, token_scores, kept_frags, and token counts.

Important: JSON cannot contain trailing commas.

### 10) Run TokenWise VS Code Extension (fully usable)

From TokenWise root:

    cd vscode-extension
    npm install
    npm run compile

Open the vscode-extension folder in VS Code and run Extension Development Host:

1. Press F5
2. In the new VS Code window, open any code file
3. Run one of these commands from Command Palette:
   - TokenWise: Prune Selected Code
   - TokenWise: Prune Current File
   - TokenWise: Check Backend Health

Default extension settings:

- tokenWise.apiUrl = http://127.0.0.1:8000
- tokenWise.timeoutMs = 120000
- tokenWise.defaultThreshold = 0.45

If backend is running, result panel will open with:

- score
- original vs pruned token counts
- reduction percentage
- original/pruned code panes
- copy and insert actions

## Optional Background Run (Server)

From swe-pruner/swe-pruner directory:

    nohup python -m swe_pruner.online_serving --model-path ./model --port 8000 > /tmp/swe_pruner.log 2>&1 &

View recent logs:

    tail -n 120 /tmp/swe_pruner.log

## Troubleshooting

### 1) 422 Unprocessable Entity with JSON decode error

Cause: invalid JSON payload, usually a trailing comma.

Fix: remove trailing comma before closing brace.

### 2) Git LFS model download fails

Cause: upstream LFS budget limit.

Fix: use Hugging Face download command shown above.

### 3) Port 8000 already in use

Find and kill process:

    netstat -ano | grep :8000 | grep LISTENING
    taskkill //F //PID <PID>

### 4) Slow prune response on CPU

- Test with smaller code first
- Confirm health endpoint says model_loaded true
- Check logs for stack traces

### 5) Backend not reachable from extension

- Verify API URL points to http://127.0.0.1:8000
- Confirm health endpoint works in terminal

## Upgrade and Sync Workflow

### Sync SWE-Pruner fork with upstream

Inside your fork clone:

    git remote add upstream https://github.com/Ayanami1314/swe-pruner.git
    git fetch upstream
    git checkout main
    git merge upstream/main
    git push origin main

### If using submodule pinning in TokenWise

After updating fork main:

    cd vendor/swe-pruner
    git pull origin main
    cd ../..
    git add vendor/swe-pruner
    git commit -m "chore: bump swe-pruner submodule"
    git push

## Manual Test Checklist

Use Manual-test.txt for complete manual validation:

- Startup checks
- Health endpoint check
- Prune endpoint test
- Negative tests
- Performance sanity loop
- Shutdown procedure

## Project Docs

- Future direction and product roadmap: future-directions.md
- Contribution guide: CONTRIBUTING.md
- Manual verification: Manual-test.txt
- Extension guide: vscode-extension/README.md

## Contributing

Contributions are welcome. Please read CONTRIBUTING.md before opening a pull request.

## License

This project is licensed under the MIT License. See LICENSE.
