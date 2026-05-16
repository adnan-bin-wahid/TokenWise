export interface CarbonEstimate {
  prefillJoules: number;
  decodeJoules: number;
  totalJoules: number;
  co2Grams: number;
  carbonIntensityGPerKwh: number;
  modelFamily: string;
  prefillRoute: "xgboost_interpolation" | "ridge_extrapolation";
  decodeRoute: "xgboost_interpolation" | "ridge_extrapolation";
  featuresSource: string;
}

export interface CarbonEstimatorInput {
  inputTokens: number;
  outputTokens: number;
  modelFamily: string;
  modelSizeB: number;
  latencyPerInputTokenMs: number;
  latencyPerOutputTokenMs: number;
  carbonIntensityGPerKwh: number;
}

interface ModelEnergyConstants {
  prefillJoulesPerInputToken: number;
  decodeJoulesPerOutputToken: number;
}

const MODEL_CONSTANTS: Record<string, ModelEnergyConstants> = {
  "gpt-4o": {
    prefillJoulesPerInputToken: 0.003,
    decodeJoulesPerOutputToken: 0.012,
  },
  "claude-3-5-sonnet": {
    prefillJoulesPerInputToken: 0.0028,
    decodeJoulesPerOutputToken: 0.0102,
  },
  "llama-3-70b": {
    prefillJoulesPerInputToken: 0.0042,
    decodeJoulesPerOutputToken: 0.0144,
  },
  default: {
    prefillJoulesPerInputToken: 0.002,
    decodeJoulesPerOutputToken: 0.008,
  },
};

function getConstants(modelFamily: string): ModelEnergyConstants {
  return MODEL_CONSTANTS[modelFamily] ?? MODEL_CONSTANTS.default;
}

function getRoute(
  modelSizeB: number,
): "xgboost_interpolation" | "ridge_extrapolation" {
  return modelSizeB > 111 ? "ridge_extrapolation" : "xgboost_interpolation";
}

// This is a deterministic SEAL-style estimator scaffold until trained regressors are wired.
export function estimateCarbon(input: CarbonEstimatorInput): CarbonEstimate {
  const constants = getConstants(input.modelFamily);
  const route = getRoute(input.modelSizeB);

  const latencyPrefillScale = Math.max(0.2, input.latencyPerInputTokenMs / 1.0);
  const latencyDecodeScale = Math.max(0.2, input.latencyPerOutputTokenMs / 1.0);

  const prefillJoules =
    input.inputTokens *
    constants.prefillJoulesPerInputToken *
    latencyPrefillScale;
  const decodeJoules =
    input.outputTokens *
    constants.decodeJoulesPerOutputToken *
    latencyDecodeScale;

  const totalJoules = prefillJoules + decodeJoules;
  const co2Grams =
    (totalJoules / 3_600_000) * Math.max(1, input.carbonIntensityGPerKwh);

  return {
    prefillJoules,
    decodeJoules,
    totalJoules,
    co2Grams,
    carbonIntensityGPerKwh: input.carbonIntensityGPerKwh,
    modelFamily: input.modelFamily,
    prefillRoute: route,
    decodeRoute: route,
    featuresSource: "fallback_constants",
  };
}
