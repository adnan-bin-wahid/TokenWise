from fastapi import FastAPI, Request
import uvicorn
import json

app = FastAPI(title="Mock OpenAI Local LLM Server")

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    req_body = await request.json()
    print("Received Chat Completion Request:")
    print(json.dumps(req_body, indent=2))

    mock_goal = {
        "task_type": "bug_fix",
        "objective": "Identify the cause of backend port conflict and address in use exception.",
        "identifiers": ["serve", "port", "conflict", "backend"],
        "observed_errors": ["Address already in use on port 8000"],
        "required_context": ["online_serving.py"],
        "retrieval_questions": [
            "Where is serve() defined or called?",
            "How is the port configuration initialized?"
        ],
        "clarification_required": False
    }

    response_content = json.dumps(mock_goal)

    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": response_content
                }
            }
        ]
    }

if __name__ == "__main__":
    # Run mock server on port 11434 (default Ollama port)
    uvicorn.run(app, host="127.0.0.1", port=11434)
