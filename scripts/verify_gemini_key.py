"""Verify Google AI Studio API key and Gemini Flash model accessibility."""

import os
import sys
import time

import httpx

from backend.config import settings


def verify_key(api_key: str | None = None, model: str | None = None) -> bool:
    """Check whether the API key can access Google AI Studio and a Flash model."""
    key = api_key or os.getenv("GEMINI_API_KEY") or settings.gemini_api_key
    target_model = (
        model
        or os.getenv("GEMINI_MODEL")
        or settings.gemini_model
        or "gemini-3.6-flash"
    )

    if not key:
        print("❌ ERROR: No GEMINI_API_KEY found in environment or .env file.")
        print("   Set GEMINI_API_KEY in your environment or .env file.")
        return False

    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else "***"
    print(f"🔍 Testing Google AI Studio key: {masked}")

    # 1. Query available models
    models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    try:
        res = httpx.get(models_url, timeout=10.0)
        if res.status_code != 200:
            print(f"❌ FAILED: Google AI API returned HTTP {res.status_code}:")
            print(f"   {res.text}")
            return False

        models_data = res.json().get("models", [])
        model_names = [m.get("name", "") for m in models_data]

        flash_models = [m for m in model_names if "flash" in m]
        print(
            f"✅ Key valid! Found {len(model_names)} models "
            f"({len(flash_models)} Flash models)."
        )

        formatted_target = (
            f"models/{target_model}"
            if not target_model.startswith("models/")
            else target_model
        )
        raw_model_name = formatted_target.replace("models/", "")

        if formatted_target not in model_names:
            print(f"\n⚠️  Target model '{raw_model_name}' was not listed directly.")
            print("   Available Flash models in your Google AI Studio catalog:")
            for f in flash_models[:6]:
                print(f"   - {f.replace('models/', '')}")
            if "models/gemini-3.6-flash" in model_names:
                raw_model_name = "gemini-3.6-flash"
                print(f"   👉 Switching to recommended active model: {raw_model_name}")

        # 2. Test generation with the model
        gen_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{raw_model_name}:generateContent?key={key}"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Respond with JSON key 'greeting' and value "
                                "'Riverside Books marketing ready'."
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {"response_mime_type": "application/json"},
        }

        print(f"\n🚀 Sending test prompt to {raw_model_name}...")
        t0 = time.time()
        gen_res = httpx.post(gen_url, json=payload, timeout=15.0)
        latency = round(time.time() - t0, 2)

        if gen_res.status_code != 200:
            print(f"❌ FAILED: Generation returned HTTP {gen_res.status_code}:")
            err_msg = gen_res.json().get("error", {}).get("message", gen_res.text)
            print(f"   {err_msg}")
            return False

        data = gen_res.json()
        output_text = data["candidates"][0]["content"]["parts"][0]["text"]
        print(f"✅ Response received from {raw_model_name} ({latency}s):")
        print(f"   {output_text.strip()}")
        print(f"\n🎉 Success! Your key is verified with {raw_model_name}.")
        return True

    except httpx.RequestError as err:
        print(f"❌ Network connection error: {err}")
        return False


if __name__ == "__main__":
    key_arg = (
        sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else None
    )
    model_arg = sys.argv[2] if len(sys.argv) > 2 else None
    success = verify_key(key_arg, model_arg)
    sys.exit(0 if success else 1)
