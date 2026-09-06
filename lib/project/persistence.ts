import { openDB, type IDBPDatabase } from "idb";
import type { ProjectMeta, Scene } from "@/types";
import { SCHEMA_VERSION, migrateScene, type ProjectFile } from "./schema";

// The database keeps its original name through the rename to Framecast:
// changing it would orphan every project a user already has.
const DB_NAME = "mockup-motion-studio";
const DB_VERSION = 2;
const STORE = "projects";
const RECORDINGS = "recordings";
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
        // Recordings are far too large to inline into a project row as a data
        // URL, so they live beside it as blobs and projects reference them.
        if (!database.objectStoreNames.contains(RECORDINGS)) {
          database.createObjectStore(RECORDINGS, { keyPath: "id" });
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
    scene: stripTransientMedia(file.scene),
  };
  const database = await db();
  await database.put(STORE, row);
  rememberLastOpened(file.project.id);
}

/**
 * A recording's `source` is an object URL, which is dead the moment the page
 * reloads. Persisting it would restore a project pointing at nothing, so it is
 * dropped on the way in and rebuilt from the blob on the way out.
 */
function stripTransientMedia(scene: Scene): Scene {
  if (scene.screen.kind !== "video") return scene;
  return { ...scene, screen: { ...scene.screen, source: "" } };
}

async function rehydrateMedia(scene: Scene): Promise<Scene> {
  const { kind, recordingId } = scene.screen;
  if (kind !== "video" || !recordingId) return scene;
  const blob = await loadRecording(recordingId);
  if (!blob) {
    // The blob is gone (cleared storage, or a project copied between
    // browsers). Fall back to an empty device rather than a broken one.
    return {
      ...scene,
      screen: { ...scene.screen, source: "", kind: "image", recordingId: undefined },
    };
  }
  return {
    ...scene,
    screen: { ...scene.screen, source: URL.createObjectURL(blob) },
  };
}

interface RecordingRow {
  id: string;
  blob: Blob;
  createdAt: number;
}

export function newRecordingId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  const database = await db();
  const row: RecordingRow = { id, blob, createdAt: Date.now() };
  await database.put(RECORDINGS, row);
}

export async function loadRecording(id: string): Promise<Blob | null> {
  const database = await db();
  const row = (await database.get(RECORDINGS, id)) as RecordingRow | undefined;
  return row?.blob ?? null;
}

export async function deleteRecording(id: string): Promise<void> {
  const database = await db();
  await database.delete(RECORDINGS, id);
}

export async function loadProject(id: string): Promise<ProjectFile | null> {
  const database = await db();
  const row = (await database.get(STORE, id)) as ProjectRow | undefined;
  if (!row) return null;
  return {
    version: row.version ?? SCHEMA_VERSION,
    project: row.project,
    scene: await rehydrateMedia(migrateScene(row.scene)),
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
  // Take the recording with the project, or its blob leaks into storage
  // forever with nothing left pointing at it.
  const row = (await database.get(STORE, id)) as ProjectRow | undefined;
  const recordingId = row?.scene?.screen?.recordingId;
  if (recordingId) await database.delete(RECORDINGS, recordingId);
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
