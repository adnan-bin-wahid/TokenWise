import { HealthResponse, PruneRequest, PruneResponse } from "../types";
import { TokenWiseConfig } from "./config";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class TokenWiseApiClient {
  public constructor(private readonly config: TokenWiseConfig) {}

  public async health(): Promise<HealthResponse> {
    const response = await fetchWithTimeout(`${this.config.apiUrl}/health`, { method: "GET" }, this.config.timeoutMs);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    return (await response.json()) as HealthResponse;
  }

  public async prune(request: PruneRequest): Promise<PruneResponse> {
    const response = await fetchWithTimeout(
      `${this.config.apiUrl}/prune`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
      this.config.timeoutMs
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Prune request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as PruneResponse;
  }
}
