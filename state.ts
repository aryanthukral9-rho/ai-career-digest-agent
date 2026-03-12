import fse from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "seen.json");

export interface State {
  seenIds: string[];
}

export async function loadState(): Promise<State> {
  try {
    const data = await fse.readJson(STATE_FILE);
    return data as State;
  } catch {
    return { seenIds: [] };
  }
}

export async function saveState(state: State): Promise<void> {
  await fse.writeJson(STATE_FILE, state, { spaces: 2 });
}

export function isNew(state: State, id: string): boolean {
  return !state.seenIds.includes(id);
}

export function markSeen(state: State, id: string): void {
  state.seenIds.push(id);
}
