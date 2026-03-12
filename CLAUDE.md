# Career Intelligence Digest Agent

## Overview

This project is an automated intelligence agent that monitors podcasts and newsletters relevant to careers in:

- Venture Capital (VC)
- Investment Banking (IB)
- Private Equity (PE)
- Startups and AI

It checks RSS feeds daily, analyzes new content with Claude, ranks relevance, and sends structured summaries via WhatsApp while logging everything to Notion.

The system is designed to:

- surface the most career-relevant insights
- avoid duplicate processing
- generate structured summaries with metrics
- maintain persistent state between runs

---

# Architecture

The pipeline works as follows:

1. Fetch RSS feeds
2. Filter unseen items
3. Analyze content using Claude
4. Rank relevance
5. Deliver summaries
6. Persist state

Flow:

fetchFeed → filter unseen → analyzeWithClaude → rank → deliver → save state

---

# File Structure

feeds.ts  
Defines all monitored RSS feeds.

Exports:
- Feed interface
- FEEDS array

Feed types:
- podcast
- newsletter

Each feed contains:

{
  name,
  url,
  type,
  emoji,
  tags[]
}

---

state.ts  
Persistence layer.

Responsibilities:

- track processed RSS items
- prevent duplicate notifications
- read/write `seen.json`

Functions:

loadState()  
saveState(state)  
isNew(state, id)  
markSeen(state, id)

Storage file:

seen.json

---

whatsapp.ts  
Sends formatted WhatsApp messages using Twilio.

Exports:

DigestItem interface

sendWhatsApp(item)

Message format:

[emoji] Publication Name (Author)  
"Title"  
URL  

Relevance: score/10 | tags  

Context: one-line explanation  

Synopsis:
1. insight with data or metrics
2. insight
3. insight

Errors should be logged but not interrupt execution.

---

notion.ts  
Logs each processed item to a Notion database.

Uses:

@notionhq/client

Database fields:

Title  
Publication  
URL  
Score  
Tags  
Summary  
Date  
Type (podcast/newsletter)

Function:

logToNotion(item)

Errors should be logged but not interrupt execution.

---

digest.ts  
Main orchestrator.

Functions:

fetchFeed(feed)

- fetch RSS feed
- normalize to RSSItem
- strip HTML
- truncate content to 800 chars
- skip feed on failure

RSSItem format:

{
 id,
 title,
 url,
 content,
 feedRef
}

---

analyzeWithClaude(item, feed)

Calls Claude once per item.

Output JSON format:

{
 score: number,
 relevantTags: string[],
 context: string,
 summary: [string, string, string]
}

Rules:

- score from 1–10
- 9–10 = directly actionable for VC/IB/PE careers
- summaries must contain concrete details when possible (funding, metrics, companies)

If JSON parsing fails:

fallback score = 5.

---

runDigest()

Main execution flow:

1. load state
2. fetch feeds in parallel
3. filter unseen items
4. analyze items sequentially (to avoid API rate limits)
5. mark items as seen
6. save state
7. rank by score
8. write markdown digest
9. send WhatsApp messages
10. log items to Notion

Each item is processed with a 1 second delay to avoid API bursts.

Markdown backup is written to:

digests/YYYY-MM-DD.md

---

scheduler.ts

Entry point.

Modes:

Immediate run:

npx tsx scheduler.ts --now

Scheduled run:

cron schedule from DIGEST_TIME env variable.

Default schedule:

0 8 * * *

---

# Environment Variables

The following variables must exist in `.env`.

Anthropic

ANTHROPIC_API_KEY=

Twilio

TWILIO_ACCOUNT_SID=  
TWILIO_AUTH_TOKEN=  
TWILIO_WHATSAPP_FROM=  
TWILIO_WHATSAPP_TO=

Notion

NOTION_API_KEY=  
NOTION_DATABASE_ID=

Scheduling

DIGEST_TIME=0 8 * * *

---

# Coding Rules

Claude should follow these rules when modifying the codebase.

1. Never change the pipeline order.
2. Do not introduce unnecessary dependencies.
3. Keep modules focused and small.
4. Fail gracefully on API errors.
5. Always preserve idempotency via `seen.json`.
6. RSS fetching must never crash the digest run.
7. Claude calls should remain sequential to avoid rate limits.

---

# Output Quality Rules

Summaries must:

- include specific numbers, funding amounts, or metrics when available
- avoid generic statements
- synthesize ideas rather than repeat text

Preferred structure:

Theme — explanation with metrics.

Example:

AI infrastructure funding — startups raised $40M Series B to build GPU orchestration layers.

---

# Future Improvements

Possible extensions:

- YouTube transcript ingestion
- trend detection across multiple feeds
- topic clustering (AI, macro, venture)
- relevance learning based on user feedback
- vector search over historical digests

---

# Important Constraints

This project should remain:

- simple
- modular
- RSS-driven
- idempotent

Do not replace the RSS architecture with scraping or heavy APIs unless explicitly requested.