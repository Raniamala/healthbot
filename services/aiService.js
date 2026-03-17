// Use SmolLM2-135M-Instruct locally via transformers.js
const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";

let generatorPromise = null;

async function getGenerator() {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      // Create a text-generation/chat pipeline; weights will be downloaded & cached locally.
      return pipeline("text-generation", MODEL_ID);
    })();
  }
  return generatorPromise;
}

async function getHealthAdvice(message) {
  const generator = await getGenerator();

  const messages = [
    {
      role: "system",
      content:
        "You are a cautious healthcare assistant. Provide only general information based on public WHO and CDC guidance. Do NOT diagnose, do NOT prescribe, and always recommend seeing a qualified doctor for serious or uncertain symptoms.Rules:No repetition,No markdown symbols like ** or * or +, Keep it simple and clean"
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
