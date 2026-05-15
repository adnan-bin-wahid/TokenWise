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
}
