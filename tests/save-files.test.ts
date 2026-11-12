import { afterEach, describe, expect, it, vi } from "vitest";
import { numberedName, saveFiles, writeUnique, type FolderHandle } from "@/lib/save-files";

/** In-memory stand-in for a FileSystemDirectoryHandle. */
function fakeFolder(opts: { permission?: PermissionState; existing?: string[]; failWrites?: string } = {}) {
  const files = new Map<string, string>((opts.existing ?? []).map((n) => [n, "old"]));
  const notFound = () => Object.assign(new Error("not found"), { name: "NotFoundError" });
  const folder = {
    name: "Resumes",
    files,
    queryPermission: vi.fn(async () => opts.permission ?? "granted"),
    requestPermission: vi.fn(async () => opts.permission ?? "granted"),
    async getFileHandle(name: string, o?: { create?: boolean }) {
      if (!files.has(name) && !o?.create) throw notFound();
      if (opts.failWrites) throw Object.assign(new Error("x"), { name: opts.failWrites });
      return {
        async createWritable() {
          let data = "";
          return {
            write: async (b: Blob) => void (data = await b.text()),
            close: async () => void files.set(name, data),
            abort: async () => {},
          };
        },
      };
    },
  };
  return folder as unknown as FolderHandle & { files: Map<string, string>; requestPermission: ReturnType<typeof vi.fn> };
}

const blob = (s: string) => new Blob([s]);

describe("numberedName", () => {
  it("numbers before the extension", () => {
    expect(numberedName("a.pdf", 1)).toBe("a.pdf");
    expect(numberedName("a.b.pdf", 2)).toBe("a.b (2).pdf");
    expect(numberedName("noext", 3)).toBe("noext (3)");
  });
});

describe("writeUnique", () => {
  it("never overwrites an existing file", async () => {
    const dir = fakeFolder({ existing: ["cv.pdf", "cv (2).pdf"] });
    expect(await writeUnique(dir, "cv.pdf", blob("new"))).toBe("cv (3).pdf");
    expect(dir.files.get("cv.pdf")).toBe("old");
    expect(dir.files.get("cv (3).pdf")).toBe("new");
  });
});

describe("saveFiles", () => {
  const downloads: string[] = [];
  afterEach(() => {
    downloads.length = 0;
    vi.unstubAllGlobals();
  });
  function stubDownloads() {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    vi.stubGlobal("document", {
      createElement: () => {
        const a = { href: "", download: "", click: () => downloads.push(a.download), remove: () => {} };
        return a;
      },
      body: { appendChild: () => {} },
    });
  }

  it("writes into the folder when access is granted", async () => {
    const dir = fakeFolder();
    const out = await saveFiles([{ name: "a.pdf", blob: blob("1") }, { name: "a.json", blob: blob("2") }], dir, false);
    expect(out).toEqual({ where: "folder", folder: "Resumes", names: ["a.pdf", "a.json"] });
    expect([...dir.files.keys()]).toEqual(["a.pdf", "a.json"]);
  });

  it("serialises concurrent saves so equal names don't collide", async () => {
    const dir = fakeFolder();
    const [a, b] = await Promise.all([
      saveFiles([{ name: "x.pdf", blob: blob("1") }], dir, false),
      saveFiles([{ name: "x.pdf", blob: blob("2") }], dir, false),
    ]);
    expect([...a.names, ...b.names]).toEqual(["x.pdf", "x (2).pdf"]);
  });

  it("falls back to downloads without permission, and only prompts when interactive", async () => {
    stubDownloads();
    const dir = fakeFolder({ permission: "prompt" });
    const out = await saveFiles([{ name: "a.pdf", blob: blob("1") }], dir, false);
    expect(out).toMatchObject({ where: "downloads", names: ["a.pdf"], note: expect.stringMatching(/Allow access/) });
    expect(dir.requestPermission).not.toHaveBeenCalled();
    expect(downloads).toEqual(["a.pdf"]);

    await saveFiles([{ name: "b.pdf", blob: blob("1") }], dir, true);
    expect(dir.requestPermission).toHaveBeenCalledOnce();
  });

  it("falls back to downloads when the folder was deleted", async () => {
    stubDownloads();
    const out = await saveFiles([{ name: "a.pdf", blob: blob("1") }], fakeFolder({ failWrites: "NotFoundError" }), false);
    expect(out).toMatchObject({ where: "downloads", note: expect.stringMatching(/no longer exists/) });
  });

  it("downloads when no folder is chosen", async () => {
    stubDownloads();
    expect(await saveFiles([{ name: "a.json", blob: blob("{}") }], null, false)).toEqual({ where: "downloads", names: ["a.json"] });
    expect(downloads).toEqual(["a.json"]);
  });
});
