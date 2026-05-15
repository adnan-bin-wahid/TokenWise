import * as vscode from "vscode";
import { TokenWiseApiClient } from "./apiClient";
import { getTokenWiseConfig } from "./config";
import { PruneResultViewModel } from "../types";

export class PruneService {
  public async checkHealth(): Promise<string> {
    const client = new TokenWiseApiClient(getTokenWiseConfig());
    const health = await client.health();
    return `Status: ${health.status}, Model loaded: ${health.model_loaded}`;
  }

  public async prune(query: string, code: string, threshold: number): Promise<PruneResultViewModel> {
    const client = new TokenWiseApiClient(getTokenWiseConfig());
    const response = await client.prune({ query, code, threshold });

    if (response.error_msg) {
      throw new Error(response.error_msg);
    }

    const reductionPercent = response.origin_token_cnt > 0
      ? ((response.origin_token_cnt - response.left_token_cnt) / response.origin_token_cnt) * 100
      : 0;

    return {
      query,
      score: response.score,
      originalCode: code,
      prunedCode: response.pruned_code,
      originTokenCount: response.origin_token_cnt,
      prunedTokenCount: response.left_token_cnt,
      modelInputTokenCount: response.model_input_token_cnt,
      reductionPercent,
      keptFrags: response.kept_frags,
    };
  }
}
