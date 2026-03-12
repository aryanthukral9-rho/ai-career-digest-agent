import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import type { DigestItem } from "./whatsapp.js";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY! });

export async function logToNotion(item: DigestItem): Promise<void> {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;
    const summaryText = item.summary.map((p, i) => `${i + 1}. ${p}`).join("\n");

    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Title: {
          title: [{ text: { content: item.title } }],
        },
        Publication: {
          rich_text: [{ text: { content: item.feedName } }],
        },
        URL: {
          url: item.url,
        },
        Score: {
          number: item.score,
        },
        Tags: {
          multi_select: item.relevantTags.map((tag) => ({ name: tag })),
        },
        Type: {
          select: { name: item.feedType },
        },
        Date: {
          date: { start: new Date().toISOString().split("T")[0] },
        },
        Summary: {
          rich_text: [{ text: { content: summaryText } }],
        },
      },
    });
    console.log(`[Notion] Logged: "${item.title}"`);
  } catch (err) {
    console.error(`[Notion] Failed to log "${item.title}":`, (err as Error).message);
  }
}
