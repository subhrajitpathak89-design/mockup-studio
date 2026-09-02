import { openDB, type IDBPDatabase } from "idb";
import type { ProjectMeta } from "@/types";
import { SCHEMA_VERSION, migrateScene, type ProjectFile } from "./schema";

const DB_NAME = "mockup-motion-studio";
const DB_VERSION = 1;
const STORE = "projects";
const LAST_OPENED_KEY = "mms:last-project";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Stored row. The screenshot lives inside `scene.screen.source` as a data URL
 * so a project is one self-contained record — object URLs would not survive a
 * reload, which is the whole point of persisting.
 */
interface ProjectRow extends ProjectFile {
  id: string;
  updatedAt: number;
}

export async function saveProject(file: ProjectFile): Promise<void> {
  const row: ProjectRow = {
    ...file,
    version: SCHEMA_VERSION,
    id: file.project.id,
    updatedAt: Date.now(),
    project: { ...file.project, updatedAt: Date.now() },
  };
  const database = await db();
  await database.put(STORE, row);
  rememberLastOpened(file.project.id);
}

export async function loadProject(id: string): Promise<ProjectFile | null> {
  const database = await db();
  const row = (await database.get(STORE, id)) as ProjectRow | undefined;
  if (!row) return null;
  return {
    version: row.version ?? SCHEMA_VERSION,
    project: row.project,
    scene: migrateScene(row.scene),
  };
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const database = await db();
  const rows = (await database.getAll(STORE)) as ProjectRow[];
  return rows
    .map((r) => r.project)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, id);
  if (getLastOpened() === id) localStorage.removeItem(LAST_OPENED_KEY);
}

export function rememberLastOpened(id: string) {
  try {
    localStorage.setItem(LAST_OPENED_KEY, id);
  } catch {
    // Private-mode browsers can refuse storage; the project is still in IDB.
  }
}

export function getLastOpened(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
}
