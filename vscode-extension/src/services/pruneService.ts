import * as vscode from "vscode";
import { TokenWiseApiClient } from "./apiClient";
import { getTokenWiseConfig } from "./config";
import { PruneResultViewModel } from "../types";
import { estimateCarbon } from "./carbonEstimator";
import { countTokens } from "./tokenCounter";

export class PruneService {
  public async checkHealth(): Promise<string> {
    const client = new TokenWiseApiClient(getTokenWiseConfig());
    const health = await client.health();
    return `Status: ${health.status}, Model loaded: ${health.model_loaded}`;
  }

  public async prune(
    query: string,
    code: string,
    threshold: number,
  ): Promise<PruneResultViewModel> {
    const cfg = getTokenWiseConfig();
    const client = new TokenWiseApiClient(cfg);
    const response = await client.prune({ query, code, threshold });

    if (response.error_msg) {
      throw new Error(response.error_msg);
    }

    const reductionPercent =
      response.origin_token_cnt > 0
        ? ((response.origin_token_cnt - response.left_token_cnt) /
            response.origin_token_cnt) *
          100
        : 0;

    const result: PruneResultViewModel = {
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

    if (cfg.enableCarbonEstimation) {
      const originalInputTokens = countTokens(code);
      const prunedInputTokens = countTokens(response.pruned_code);

      const carbonBefore = estimateCarbon({
        inputTokens: originalInputTokens,
        outputTokens: cfg.expectedOutputTokens,
        modelFamily: cfg.targetModelName,
        modelSizeB: cfg.targetModelSizeB,
        latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
        latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
        carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
      });

      const carbonAfter = estimateCarbon({
        inputTokens: prunedInputTokens,
        outputTokens: cfg.expectedOutputTokens,
        modelFamily: cfg.targetModelName,
        modelSizeB: cfg.targetModelSizeB,
        latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
        latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
        carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
      });

      result.carbonBefore = carbonBefore;
      result.carbonAfter = carbonAfter;
      result.carbonSavings = {
        prefillJoulesSaved: carbonBefore.prefillJoules - carbonAfter.prefillJoules,
        decodeJoulesSaved: carbonBefore.decodeJoules - carbonAfter.decodeJoules,
        totalJoulesSaved: carbonBefore.totalJoules - carbonAfter.totalJoules,
        co2GramsSaved: carbonBefore.co2Grams - carbonAfter.co2Grams,
      };
    }

    return result;
  }
}
