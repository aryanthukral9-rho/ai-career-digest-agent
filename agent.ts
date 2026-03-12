import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askClaude(prompt: string) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      { role: "user", content: prompt }
    ]
  });

  console.log("\nClaude:", response.content[0].text);
}

function startChat() {
  rl.question("\nYou: ", async (input) => {
    await askClaude(input);
    startChat();
  });
}

console.log("Agent ready.");
startChat();