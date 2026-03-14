import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { FEEDS, type Feed } from "./feeds.js";
import { loadState, saveState, isNew, markSeen, appendHistory, loadConfig } from "./state.js";
import { sendWhatsApp, type DigestItem } from "./whatsapp.js";
import { logToNotion } from "./notion.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new Parser();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RSSItem {
  id: string;
  title: string;
  url: string;
  content: string;
  feedRef: Feed;
}

interface ClaudeAnalysis {
  score: number;
  relevantTags: string[];
  context: string;
  summary: [string, string, string];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchFeed(feed: Feed): Promise<RSSItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const sorted = (parsed.items ?? []).sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });

    return sorted.slice(0, 15).map((item) => {
      const raw = item.contentSnippet ?? item.content ?? item.summary ?? "";
      const content = stripHtml(raw).slice(0, 800);
      return {
        id: item.guid ?? item.link ?? item.title ?? "",
        title: item.title ?? "(untitled)",
        url: item.link ?? feed.url,
        content,
        feedRef: feed,
      };
    });
  } catch (err) {
    console.error(`[Feed] Failed to fetch "${feed.name}":`, (err as Error).message);
    return [];
  }
}

async function analyzeWithClaude(item: RSSItem, feed: Feed): Promise<ClaudeAnalysis> {
  const prompt = `You are a career intelligence analyst for someone targeting VC, IB, and PE careers.

Analyze this ${feed.type} item and return JSON only:

Feed: ${feed.name} (${feed.tags.join(", ")})
Title: ${item.title}
Content: ${item.content}

Return exactly this JSON shape:
{
  "score": <1-10, where 9-10 = directly actionable for VC/IB/PE career>,
  "relevantTags": <array of matching tags from: VC, IB, PE, AI, Tech, Finance, Startups, Growth, India>,
  "context": <one sentence explaining why this matters for the career focus>,
  "summary": [
    "<key insight 1 with specific numbers/companies/metrics where available>",
    "<key insight 2>",
    "<key insight 3>"
  ]
}`;

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      return JSON.parse(jsonMatch[0]) as ClaudeAnalysis;
    } catch (err) {
      const error = err as { status?: number; message?: string };
      const isRateLimit = error.status === 429;
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isLastAttempt) {
        console.error(`[Claude] All retries failed for "${item.title}":`, error.message);
        break;
      }

      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `[Claude] ${isRateLimit ? "Rate limited" : "Error"} on "${item.title}" — retry ${attempt + 1}/${MAX_RETRIES - 1} in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    score: 5,
    relevantTags: feed.tags,
    context: "Analysis unavailable.",
    summary: [item.title, "", ""],
  };
}

export async function runDigest(): Promise<void> {
  console.log("[Digest] Starting run...");
  const [state, config] = await Promise.all([loadState(), loadConfig()]);

  // 1. Fetch all feeds in parallel
  const allItems = (
    await Promise.all(FEEDS.map((feed) => fetchFeed(feed)))
  ).flat();

  // 2. Filter unseen — checks both guid and title+url hash
  const newItems = allItems.filter((item) =>
    isNew(state, item.id, item.title, item.url)
  );
  console.log(`[Digest] ${newItems.length} new items across ${FEEDS.length} feeds`);

  if (newItems.length === 0) {
    console.log("[Digest] Nothing new. Done.");
    return;
  }

  // 3. Cap to newest 2 unseen items per feed
  const MAX_PER_FEED = 2;
  const seenFeeds = new Map<string, number>();
  const candidates = newItems.filter((item) => {
    const count = seenFeeds.get(item.feedRef.name) ?? 0;
    if (count >= MAX_PER_FEED) return false;
    seenFeeds.set(item.feedRef.name, count + 1);
    return true;
  });
  console.log(`[Digest] ${candidates.length} candidates after per-feed cap`);

  // 4. Analyze sequentially (avoid API rate limits)
  const results: DigestItem[] = [];
  for (const item of candidates) {
    const analysis = await analyzeWithClaude(item, item.feedRef);
    markSeen(state, item.id, item.title, item.url);
    results.push({
      feedName: item.feedRef.name,
      feedAuthor: item.feedRef.author,
      feedEmoji: item.feedRef.emoji,
      feedTags: item.feedRef.tags,
      feedType: item.feedRef.type,
      title: item.title,
      url: item.url,
      score: analysis.score,
      context: analysis.context,
      summary: analysis.summary,
      relevantTags: analysis.relevantTags,
    });
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 4. Save state
  await saveState(state);

  // 5. Rank by score descending, cap at top 20
  results.sort((a, b) => b.score - a.score);
  const top20 = results.slice(0, 20);

  // 6. Write markdown digest
  const today = new Date().toISOString().split("T")[0];
  const digestDir = path.join(__dirname, "digests");
  fs.mkdirSync(digestDir, { recursive: true });
  const mdPath = path.join(digestDir, `${today}.md`);
  const md = top20
    .map(
      (r) =>
        `## ${r.feedEmoji} ${r.feedName} — ${r.title}\n` +
        `Score: ${r.score}/10 | Tags: ${r.relevantTags.join(", ")}\n` +
        `URL: ${r.url}\n\n` +
        `> ${r.context}\n\n` +
        r.summary.filter(Boolean).map((s, i) => `${i + 1}. ${s}`).join("\n")
    )
    .join("\n\n---\n\n");
  fs.writeFileSync(mdPath, `# Digest — ${today}\n\n${md}`);
  console.log(`[Digest] Written to ${mdPath}`);

  // 7. Send WhatsApp + log to Notion (only items scoring >= 6)
  const toSend = top20.filter((r) => r.score >= config.minScore);
  for (const item of toSend) {
    await sendWhatsApp(item);
    await logToNotion(item);
  }

  // 8. Append run to history
  await appendHistory({
    date: today,
    itemCount: results.length,
    topScore: top20[0]?.score ?? 0,
  });

  console.log(
    `[Digest] Done. ${results.length} analyzed, ${top20.length} in digest, ${toSend.length} sent.`
  );
}
