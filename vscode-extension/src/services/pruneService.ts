import * as vscode from "vscode";
import { TokenWiseApiClient } from "./apiClient";
import { getTokenWiseConfig } from "./config";
import { CarbonEstimateResponse, PruneResultViewModel } from "../types";
import { estimateCarbon } from "./carbonEstimator";
import { countTokens } from "./tokenCounter";

export class PruneService {
  private sessionCo2GramsSaved = 0;

  private mapRemoteEstimate(response: CarbonEstimateResponse) {
    return {
      prefillJoules: response.prefill_joules,
      decodeJoules: response.decode_joules,
      totalJoules: response.total_joules,
      co2Grams: response.co2_grams,
      carbonIntensityGPerKwh: response.carbon_intensity_g_per_kwh,
      modelFamily: response.model_name,
      route: response.route,
    } as const;
  }

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

      let carbonBefore;
      let carbonAfter;
      if (cfg.carbonEstimatorMode === "remote") {
        try {
          const beforeRemote = await client.estimateCarbon({
            input_tokens: originalInputTokens,
            output_tokens: cfg.expectedOutputTokens,
            model_name: cfg.targetModelName,
            model_size_b: cfg.targetModelSizeB,
            latency_per_input_token_ms: cfg.latencyPerInputTokenMs,
            latency_per_output_token_ms: cfg.latencyPerOutputTokenMs,
            carbon_intensity_g_per_kwh: cfg.carbonIntensityGPerKwh,
          });
          const afterRemote = await client.estimateCarbon({
            input_tokens: prunedInputTokens,
            output_tokens: cfg.expectedOutputTokens,
            model_name: cfg.targetModelName,
            model_size_b: cfg.targetModelSizeB,
            latency_per_input_token_ms: cfg.latencyPerInputTokenMs,
            latency_per_output_token_ms: cfg.latencyPerOutputTokenMs,
            carbon_intensity_g_per_kwh: cfg.carbonIntensityGPerKwh,
          });
          carbonBefore = this.mapRemoteEstimate(beforeRemote);
          carbonAfter = this.mapRemoteEstimate(afterRemote);
        } catch {
          carbonBefore = estimateCarbon({
            inputTokens: originalInputTokens,
            outputTokens: cfg.expectedOutputTokens,
            modelFamily: cfg.targetModelName,
            modelSizeB: cfg.targetModelSizeB,
            latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
            latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
            carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
          });
          carbonAfter = estimateCarbon({
            inputTokens: prunedInputTokens,
            outputTokens: cfg.expectedOutputTokens,
            modelFamily: cfg.targetModelName,
            modelSizeB: cfg.targetModelSizeB,
            latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
            latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
            carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
          });
        }
      } else {
        carbonBefore = estimateCarbon({
          inputTokens: originalInputTokens,
          outputTokens: cfg.expectedOutputTokens,
          modelFamily: cfg.targetModelName,
          modelSizeB: cfg.targetModelSizeB,
          latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
          latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
          carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
        });

        carbonAfter = estimateCarbon({
          inputTokens: prunedInputTokens,
          outputTokens: cfg.expectedOutputTokens,
          modelFamily: cfg.targetModelName,
          modelSizeB: cfg.targetModelSizeB,
          latencyPerInputTokenMs: cfg.latencyPerInputTokenMs,
          latencyPerOutputTokenMs: cfg.latencyPerOutputTokenMs,
          carbonIntensityGPerKwh: cfg.carbonIntensityGPerKwh,
        });
      }

      result.carbonBefore = carbonBefore;
      result.carbonAfter = carbonAfter;
      result.carbonSavings = {
        prefillJoulesSaved: carbonBefore.prefillJoules - carbonAfter.prefillJoules,
        decodeJoulesSaved: carbonBefore.decodeJoules - carbonAfter.decodeJoules,
        totalJoulesSaved: carbonBefore.totalJoules - carbonAfter.totalJoules,
        co2GramsSaved: carbonBefore.co2Grams - carbonAfter.co2Grams,
      };
      this.sessionCo2GramsSaved += result.carbonSavings.co2GramsSaved;
    }

    return result;
  }

  public getSessionCo2GramsSaved(): number {
    return this.sessionCo2GramsSaved;
  }
}
