from __future__ import annotations

from dataclasses import dataclass

LLM_PERF_REQUIRED_COLUMNS = [
    "model_name",
    "precision",
    "num_input_tokens",
    "num_output_tokens",
    "latency_per_input_token_ms",
    "latency_per_output_token_ms",
    "prefill_energy_j",
    "decode_energy_j",
    "gpu_type",
]

OPEN_LLM_REQUIRED_COLUMNS = [
    "model_name",
    "precision",
    "model_size_b",
    "mmlu_pro_score",
    "bbh_score",
]

MERGED_REQUIRED_COLUMNS = [
    *LLM_PERF_REQUIRED_COLUMNS,
    "model_size_b",
    "mmlu_pro_score",
    "bbh_score",
]


@dataclass(frozen=True)
class MergeStats:
    llm_perf_rows: int
    open_llm_rows: int
    merged_rows: int
    deduped_rows: int
    dropped_missing_rows: int


def canonicalize_model_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def canonicalize_precision(value: str) -> str:
    return value.strip().lower().replace("fp", "float")
