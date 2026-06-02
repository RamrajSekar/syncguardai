import OpenAI from "openai";
// If using standard CommonJS, use: const OpenAI = require("openai");

const openai = new OpenAI(); // Automatically reads process.env.OPENAI_API_KEY

async function testConnection() {
  try {
    console.log("Checking OpenAI API connection...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // A fast, cheap model perfect for local testing
      messages: [{ role: "user", content: "Connection test. Respond with 'OK'." }],
      max_tokens: 5
    });

    console.log("Success! Response from OpenAI:", response.choices[0].message.content.trim());
  } catch (error) {
    console.error("Connection Failed!");
    console.error("Error Details:", error.message);
  }
}

testConnection();