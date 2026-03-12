import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

export interface DigestItem {
  feedName: string;
  feedAuthor?: string;
  feedEmoji: string;
  feedTags: string[];
  feedType: "podcast" | "newsletter";
  title: string;
  url: string;
  score: number;
  context: string;
  summary: string[];
  relevantTags: string[];
}

function formatMessage(item: DigestItem): string {
  const author = item.feedAuthor ? ` (${item.feedAuthor})` : "";
  const tags = item.relevantTags.join(" | ");
  const synopsis = item.summary
    .map((point, i) => `${i + 1}. ${point}`)
    .join("\n");

  return [
    `${item.feedEmoji} *${item.feedName}*${author}`,
    `"${item.title}"`,
    item.url,
    `Relevance: ${item.score}/10 | ${tags}`,
    "",
    `Context: ${item.context}`,
    `Synopsis:`,
    synopsis,
  ].join("\n");
}

export async function sendWhatsApp(item: DigestItem): Promise<void> {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    const body = formatMessage(item);
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: process.env.TWILIO_WHATSAPP_TO!,
      body,
    });
    console.log(`[WhatsApp] Sent: "${item.title}" (${item.score}/10)`);
  } catch (err) {
    console.error(`[WhatsApp] Failed to send "${item.title}":`, (err as Error).message);
  }
}
