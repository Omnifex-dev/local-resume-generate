/**
 * Browser-side saving: write into a folder the user picked (File System Access
 * API, Chrome/Edge on http://localhost or https) or fall back to a normal
 * download into the browser's Downloads folder.
 */

type ReadWrite = { mode: "readwrite" };

/** Permission methods aren't in TypeScript's DOM types yet. */
export type FolderHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: ReadWrite) => Promise<PermissionState>;
  requestPermission?: (d: ReadWrite) => Promise<PermissionState>;
};

type DirectoryPicker = (options?: { id?: string; mode?: "readwrite"; startIn?: string }) => Promise<FileSystemDirectoryHandle>;

export type SaveFile = { name: string; blob: Blob };
export type SaveOutcome = { where: "folder"; folder: string; names: string[] } | { where: "downloads"; names: string[]; note?: string };

const RW: ReadWrite = { mode: "readwrite" };

export function folderPickerSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

/** Opens the folder picker (must run inside a click handler). Returns null if the user cancels. */
export async function pickFolder(): Promise<FolderHandle | null> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  try {
    return (await picker({ id: "resume-generate", mode: "readwrite", startIn: "downloads" })) as FolderHandle;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

/**
 * True when we may write to the folder. With `request`, asks the user if needed;
 * that only works during a click (the browser requires a user gesture).
 */
export async function folderAccess(handle: FolderHandle, request: boolean): Promise<boolean> {
  if (!handle.queryPermission) return true;
  try {
    if ((await handle.queryPermission(RW)) === "granted") return true;
    if (!request || !handle.requestPermission) return false;
    return (await handle.requestPermission(RW)) === "granted";
  } catch {
    return false;
  }
}

/** "a.pdf", 2 → "a (2).pdf" */
export function numberedName(name: string, n: number): string {
  if (n <= 1) return name;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

type WritableDir = Pick<FileSystemDirectoryHandle, "getFileHandle">;

/** Writes without overwriting: an existing "a.pdf" makes this "a (2).pdf". Returns the name used. */
export async function writeUnique(dir: WritableDir, name: string, blob: Blob): Promise<string> {
  for (let n = 1; n <= 999; n++) {
    const candidate = numberedName(name, n);
    try {
      await dir.getFileHandle(candidate);
      continue; // exists
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") throw e;
    }
    const file = await dir.getFileHandle(candidate, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
    return candidate;
  }
  throw new Error(`Too many files named ${name}.`);
}

// Saves run one at a time so two results with the same name can't both claim "a.pdf".
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => {});
  return next;
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Saves files to `folder` when access is granted, otherwise downloads them.
 * `interactive` = called from a click, so a permission prompt may be shown.
 */
export function saveFiles(files: SaveFile[], folder: FolderHandle | null, interactive: boolean): Promise<SaveOutcome> {
  return serial(async () => {
    let note: string | undefined;
    if (folder) {
      if (await folderAccess(folder, interactive)) {
        try {
          const names: string[] = [];
          for (const f of files) names.push(await writeUnique(folder, f.name, f.blob));
          return { where: "folder", folder: folder.name, names };
        } catch (e) {
          const name = (e as DOMException).name;
          note =
            name === "NotFoundError"
              ? `The folder “${folder.name}” no longer exists; choose it again.`
              : `Could not write to “${folder.name}” (${name || "error"}).`;
        }
      } else {
        note = `No access to “${folder.name}” yet; click “Allow access”.`;
      }
    }
    for (const f of files) downloadBlob(f.name, f.blob);
    return { where: "downloads", names: files.map((f) => f.name), ...(note ? { note } : {}) };
  });
}

// --- Remembering the chosen folder (IndexedDB can store directory handles) ---

const DB_NAME = "resume-generate";
const STORE = "save-folder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Folders are remembered per app user, so two accounts in one browser don't share one. */
export const loadFolder = (userKey: string) =>
  withStore<FolderHandle | undefined>("readonly", (s) => s.get(userKey)).then((h) => h ?? null).catch(() => null);
export const storeFolder = (userKey: string, h: FolderHandle) => withStore<unknown>("readwrite", (s) => s.put(h, userKey));
export const forgetFolder = (userKey: string) => withStore<unknown>("readwrite", (s) => s.delete(userKey));
