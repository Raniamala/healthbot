const express = require("express");
const router = express.Router();
const { getHealthAdvice } = require("../services/aiService");

router.post("/", async (req, res) => {
  const { message } = req.body;

  try {
    console.log("message", message);
    const reply = await getHealthAdvice(message);

    res.json({
      reply,
      disclaimer:
        "This chatbot provides informational guidance only and does not replace medical professionals."
    });
  } catch (error) {
    const data = error.response?.data;
    const status = error.response?.status;
    const msg = data?.error || data?.message || error.message || "AI service failed";
    console.error("Chat error:", status, data || error.message);
    res.status(status && status >= 400 ? status : 500).json({
      error: status === 503 ? "Model is warming up. Please try again in 20–30 seconds." : "AI service failed",
      detail: msg
    });
  }
});

module.exports = router;