async function getHealthAdvice(message) {
  // Use SmolLM2 locally via transformers.js (dev + prod).
  // Note: on Render free tier, first-time model download/init can be slow;
  // keep generation small to reduce request timeouts.
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
    max_new_tokens: process.env.NODE_ENV === "production" ? 96 : 256,
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
