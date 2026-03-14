import fse from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, "memory");

const SEEN_FILE = path.join(MEMORY_DIR, "seen.json");
const CONFIG_FILE = path.join(MEMORY_DIR, "config.json");
const HISTORY_FILE = path.join(MEMORY_DIR, "history.json");

// --- Seen state ---

export interface State {
  seenIds: string[];
  seenHashes: string[];
}

export function hashItem(title: string, url: string): string {
  return crypto.createHash("sha256").update(`${title}::${url}`).digest("hex");
}

export async function loadState(): Promise<State> {
  try {
    const data = await fse.readJson(SEEN_FILE);
    return {
      seenIds: data.seenIds ?? [],
      seenHashes: data.seenHashes ?? [],
    };
  } catch {
    return { seenIds: [], seenHashes: [] };
  }
}

export async function saveState(state: State): Promise<void> {
  await fse.writeJson(SEEN_FILE, state, { spaces: 2 });
}

export function isNew(state: State, id: string, title: string, url: string): boolean {
  const hash = hashItem(title, url);
  return !state.seenIds.includes(id) && !state.seenHashes.includes(hash);
}

export function markSeen(state: State, id: string, title: string, url: string): void {
  state.seenIds.push(id);
  state.seenHashes.push(hashItem(title, url));
}

// --- Config ---

export interface Config {
  digestTime: string;
  maxItemsPerRun: number;
  minScore: number;
}

export async function loadConfig(): Promise<Config> {
  try {
    const data = await fse.readJson(CONFIG_FILE);
    return data as Config;
  } catch {
    return { digestTime: "0 8 * * *", maxItemsPerRun: 20, minScore: 5 };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fse.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

// --- History ---

export interface HistoryRun {
  date: string;
  itemCount: number;
  topScore: number;
}

export interface History {
  runs: HistoryRun[];
}

export async function loadHistory(): Promise<History> {
  try {
    const data = await fse.readJson(HISTORY_FILE);
    return data as History;
  } catch {
    return { runs: [] };
  }
}

export async function appendHistory(run: HistoryRun): Promise<void> {
  const history = await loadHistory();
  history.runs.push(run);
  await fse.writeJson(HISTORY_FILE, history, { spaces: 2 });
}
