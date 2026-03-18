async function getHealthAdvice(message) {
  // To keep Render deployment lightweight and avoid timeouts/OOM,
  // use a simple rules-based response in production.
  if (process.env.NODE_ENV === "production") {
    return (
      "Here is some general guidance based on the symptoms you described.\n\n" +
      `Your symptoms: ${message}\n\n` +
      "1) This chatbot cannot diagnose or prescribe. It can only give basic information.\n" +
      "2) If you have very high fever, difficulty breathing, chest pain, confusion, or feel very unwell, go to emergency care or call local emergency services.\n" +
      "3) For mild fever, many people rest, drink plenty of fluids, and use over‑the‑counter fever medicines if they are normally safe for them.\n" +
      "4) If symptoms last more than a few days, get worse instead of better, or you have other medical problems (like heart disease, lung disease, pregnancy, or a weak immune system), see a doctor as soon as possible.\n" +
      "Always follow advice from a licensed doctor or your local health authority. This chatbot is only for basic information."
    );
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
