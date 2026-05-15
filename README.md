# TokenWise

TokenWise is a developer-friendly context optimization tool built on top of SWE-Pruner.
It helps reduce irrelevant code context before sending prompts to coding assistants.

## Why TokenWise

- Reduce token usage in AI prompts
- Improve response latency by shrinking context
- Keep prompt quality high with task-aware pruning
- Integrate naturally with editor workflows

## Current Status

This repository is in active early development.

Current contents:
- Product planning docs for a VS Code extension
- Manual validation notes for SWE-Pruner setup and API behavior
- Upstream SWE-Pruner source checkout under the `swe-pruner/` directory

## Repository Layout

.
├── README.md
├── future-directions.md
├── Manual-test.txt
├── swe-pruner/
└── .venv/ (local only, ignored)

## Roadmap

Near-term goals:
1. Build a VS Code extension MVP for one-click context pruning
2. Add local and hosted backend modes
3. Add copy/insert flows for AI chat contexts
4. Track token reduction and reliability metrics

See details in `future-directions.md`.

## Getting Started (Current Local Setup)

Prerequisites:
- Python 3.12
- Git Bash (Windows) or compatible shell

From repo root:

```bash
cd "swe-pruner/swe-pruner"
```

Start local SWE-Pruner API:

```bash
"/e/A A SPL3/part-2/swe-pruner/.venv/Scripts/python.exe" -m swe_pruner.online_serving --model-path ./model --port 8000
```

Health check:

```bash
curl -sS http://127.0.0.1:8000/health
```

## Contributing

Contributions are welcome.
Please read `CONTRIBUTING.md` before opening a pull request.

## License

This project is licensed under the MIT License. See `LICENSE`.
