# Modal vLLM inference server — Qwen2.5-7B-Instruct, OpenAI-compatible endpoint
#
# DEPLOY (after `modal token new`):
#   modal deploy modal_llm.py
#
# GET THE WEB URL after deploy:
#   modal app list          — find the app named "handsoff-llm"
#   modal serve modal_llm.py --detach  (shows URL in output)
#   Or: the URL pattern is https://<your-workspace>--handsoff-llm-serve.modal.run
#   Confirm with: modal app logs handsoff-llm  (URL printed at startup)
#
# API KEY: hardcoded constant HANDSOFF_API_KEY below (fine for hackathon).
#   Set MODAL_LLM_API_KEY=<value> in your local .env.local and on Vercel.
#
# ENV VARS TO SET (local .env.local + Vercel):
#   MODAL_LLM_BASE_URL=https://<workspace>--handsoff-llm-serve.modal.run/v1
#   MODAL_LLM_API_KEY=handsoff-demo-key-2024
#   MODAL_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct

import modal
import subprocess

# ── Constants ──────────────────────────────────────────────────────────────────

MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"
VLLM_PORT = 8000
MINUTES = 60

# Hardcoded API key — good enough for a hackathon demo.
# Change this or move to a Modal Secret before any real use.
HANDSOFF_API_KEY = "handsoff-demo-key-2024"

# ── Modal app + Volume ─────────────────────────────────────────────────────────

app = modal.App("handsoff-llm")

# Persistent volume so model weights survive redeploys (no re-download on warm start)
hf_cache_vol = modal.Volume.from_name("handsoff-hf-cache", create_if_missing=True)

# ── Container image ────────────────────────────────────────────────────────────

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm>=0.6.0",
        "huggingface_hub",
        "fastapi",
        "uvicorn",
    )
    # Disable flashinfer's runtime JIT sampler. The slim image has no nvcc/CUDA
    # toolkit, so flashinfer crashes the API server trying to compile its
    # top-k/top-p kernel at inference time. Fall back to vLLM's native Torch
    # sampler + FlashAttention, neither of which needs runtime compilation.
    .env(
        {
            "VLLM_USE_FLASHINFER_SAMPLER": "0",
            "VLLM_ATTENTION_BACKEND": "FLASH_ATTN",
        }
    )
)

# ── Serve function ─────────────────────────────────────────────────────────────

@app.function(
    image=vllm_image,
    gpu="L4",                          # L4 is plenty for 7B; bump to A10G if needed
    timeout=10 * MINUTES,
    scaledown_window=20 * MINUTES,     # keep container warm for 20 min between requests
    min_containers=1,                  # never scale to zero — no cold starts during demo
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
    },
)
@modal.concurrent(max_inputs=50)
@modal.web_server(port=VLLM_PORT, startup_timeout=10 * MINUTES)
def serve():
    """
    Starts a vLLM OpenAI-compatible server on VLLM_PORT.
    The Volume provides a persistent HuggingFace cache so the model
    is only downloaded once, making redeploys fast.

    Authentication is handled at the vLLM API key level:
    vLLM's --api-key flag rejects requests missing the Bearer token.
    """
    cmd = [
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", MODEL_ID,
        "--port", str(VLLM_PORT),
        "--host", "0.0.0.0",
        "--api-key", HANDSOFF_API_KEY,   # vLLM enforces Bearer auth on all /v1/* routes
        "--max-model-len", "8192",       # keep VRAM headroom on L4 (16 GB)
        "--dtype", "auto",
        "--trust-remote-code",
    ]
    subprocess.Popen(cmd)
