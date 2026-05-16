export interface PruneRequest {
  query: string;
  code: string;
  threshold: number;
}

export interface PruneResponse {
  score: number;
  pruned_code: string;
  token_scores: [string, number][];
  kept_frags: number[];
  origin_token_cnt: number;
  left_token_cnt: number;
  model_input_token_cnt: number;
  error_msg: string | null;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
}

export interface CarbonEstimateViewModel {
  prefillJoules: number;
  decodeJoules: number;
  totalJoules: number;
  co2Grams: number;
  carbonIntensityGPerKwh: number;
  modelFamily: string;
  route: "xgboost_interpolation" | "ridge_extrapolation";
}

export interface CarbonEstimateRequest {
  input_tokens: number;
  output_tokens: number;
  model_name: string;
  model_size_b: number;
  latency_per_input_token_ms: number;
  latency_per_output_token_ms: number;
  carbon_intensity_g_per_kwh: number;
}

export interface CarbonEstimateResponse {
  prefill_joules: number;
  decode_joules: number;
  total_joules: number;
  co2_grams: number;
  carbon_intensity_g_per_kwh: number;
  model_name: string;
  route: "xgboost_interpolation" | "ridge_extrapolation";
}

export interface CarbonSavingsViewModel {
  prefillJoulesSaved: number;
  decodeJoulesSaved: number;
  totalJoulesSaved: number;
  co2GramsSaved: number;
}

export interface PruneResultViewModel {
  query: string;
  score: number;
  originalCode: string;
  prunedCode: string;
  originTokenCount: number;
  prunedTokenCount: number;
  modelInputTokenCount: number;
  reductionPercent: number;
  keptFrags: number[];
  carbonBefore?: CarbonEstimateViewModel;
  carbonAfter?: CarbonEstimateViewModel;
  carbonSavings?: CarbonSavingsViewModel;
}
