import os
import json
import re
import html
import litellm
import yaml

litellm.drop_params = True
litellm.set_verbose = False
litellm.model_cost = {}  # Disable fetching model cost map

# Set API keys from environment
if os.getenv("ANTHROPIC_API_KEY"):
    os.environ["ANTHROPIC_API_KEY"] = os.getenv("ANTHROPIC_API_KEY")
elif os.getenv("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
if os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

config_path = os.path.join(os.path.dirname(__file__), "..", "..", "litellm_config.yaml")
if os.path.exists(config_path):
    with open(config_path) as f:
        config = yaml.safe_load(f)
        if config and "model_list" in config:
            for m in config["model_list"]:
                if "genius-ai-model" in m.get("model_name", ""):
                    litellm_params = m.get("litellm_params", {})
                    os.environ.setdefault("LITELLM_MODEL", litellm_params.get("model", "ollama/llama3.2:1b"))
                    os.environ.setdefault("LITELLM_API_BASE", litellm_params.get("api_base", "http://localhost:11434"))
                    break

def _model() -> str:
    return os.getenv("LITELLM_MODEL", "ollama/llama3.2:1b")


def _api_base() -> str:
    return os.getenv("LITELLM_API_BASE", "http://localhost:11434")


SYSTEM_PROMPT = (
    "You are a senior technical recruiter at Juspay, a fintech company building "
    "high-performance payment products. You evaluate candidates objectively and "
    "respond ONLY with valid JSON — no markdown, no explanation."
)


def _sanitize(text: str, max_len: int = 8000) -> str:
    text = html.escape(str(text).strip())
    text = re.sub(r"(ignore|disregard|forget).{0,30}(above|previous|instructions)", "", text, flags=re.I)
    return text[:max_len]


def _extract_json(raw: str) -> str:
    """Extract the first complete JSON object from raw LLM output."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        return raw
    return raw[start:end + 1]


async def _call_model(model: str, prompt: str, system: str, api_base: str = None, api_key: str = None) -> str:
    kwargs = dict(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    if api_base:
        kwargs["api_base"] = api_base
    if api_key:
        kwargs["api_key"] = api_key
    response = await litellm.acompletion(**kwargs)
    raw = response.choices[0].message.content or ""
    print(f"[{model}] Raw Response: {raw}")
    return _extract_json(raw)


async def litellm_generate(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    """Call Juspay Grid first, fall back to local Ollama."""
    grid_key = os.getenv("JUSPAY_GRID_API_KEY")
    grid_base = os.getenv("JUSPAY_GRID_BASE_URL", "https://grid.ai.juspay.net/v1")
    grid_model = os.getenv("JUSPAY_GRID_MODEL", "open-large")

    if grid_key:
        try:
            return await _call_model(
                f"openai/{grid_model}", prompt, system,
                api_base=grid_base, api_key=grid_key
            )
        except Exception as e:
            print(f"Juspay Grid failed ({e}), falling back to Ollama...")

    return await _call_model(
        "ollama/llama3:latest", prompt, system,
        api_base="http://127.0.0.1:11434"
    )


ollama_generate = litellm_generate