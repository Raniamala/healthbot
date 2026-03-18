function buildPrompt(message) {
  return `
You are a cautious healthcare assistant.
Provide basic guidance only.
Do NOT diagnose diseases.
Do NOT prescribe medication.
Base advice on general public health guidance (WHO/CDC-style), and include clear "seek urgent care" red flags when appropriate.
Keep the answer simple and clean (no markdown).

User symptoms: ${message}

Return:
1) Possible causes (high-level, non-diagnostic)
2) Self-care steps
3) When to see a doctor
4) When to seek urgent/emergency care
`;
}

async function hfTextGeneration({ model, inputs, accessToken }) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs,
      parameters: {
        max_new_tokens: 256,
        temperature: 0.4,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false
      }
    })
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Common shapes:
  // - [{ generated_text: "..." }]
  // - { generated_text: "..." }
  if (Array.isArray(data) && typeof data?.[0]?.generated_text === "string") return data[0].generated_text;
  if (data && typeof data.generated_text === "string") return data.generated_text;

  // Some models may return plain string
  if (typeof data === "string") return data;

  return JSON.stringify(data);
}

async function getHealthAdvice(message) {
  // Production: call HF Serverless Inference (AI response, lightweight backend).
  if (process.env.NODE_ENV === "production") {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error("HF_TOKEN is not set (required in production)");
    }

    const prompt = buildPrompt(message);

    // Prefer instruction-tuned text2text model for safer formatting.
    // If the first model is loading/unavailable, fallback to an alternate.
    const candidates = [
      "google/flan-t5-base",
      "google/flan-t5-large"
    ];

    let lastErr;
    for (const model of candidates) {
      try {
        return await hfTextGeneration({ model, inputs: prompt, accessToken: token });
      } catch (e) {
        lastErr = e;
        // If model is loading, bubble up a clean error so frontend can retry.
        if (e?.status === 503) {
          throw e;
        }
      }
    }
    throw lastErr || new Error("HF inference failed");
  }

  // Local development: keep using the SmolLM2 model via transformers.js
  const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";
  let generatorPromise = global.__healthbotGeneratorPromise;

  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("text-generation", MODEL_ID);
    })();
    // cache on global so dev hot-reloads reuse it
    global.__healthbotGeneratorPromise = generatorPromise;
  }

  const generator = await generatorPromise;

  const messages = [
    {
      role: "system",
      content:
        "You are a cautious healthcare assistant. Provide only general information based on public WHO and CDC guidance. Do NOT diagnose, do NOT prescribe, and always recommend seeing a qualified doctor for serious or uncertain symptoms. Rules: No repetition, no markdown symbols like ** or * or +, keep it simple and clean."
    },
    {
      role: "user",
      content: `My symptoms are: ${message}. Please explain possible causes in simple language, suggest basic self-care, and when to see a doctor or emergency care.`
    }
  ];

  const output = await generator(messages, {
    max_new_tokens: 256,
    temperature: 0.4,
    top_p: 0.9
  });

  const turn = output?.[0]?.generated_text?.at(-1);
  const text =
    typeof turn === "object" && turn !== null && typeof turn.content === "string"
      ? turn.content
      : JSON.stringify(output);

  return text;
}

module.exports = { getHealthAdvice };
