import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Storage for uploaded media. Only a local-disk driver exists today; an S3
 * driver can implement the same interface and be selected via STORAGE_DRIVER.
 */
export interface MediaStorage {
  /** Moves an already-written temp file into storage and returns its key. */
  saveFromPath(tmpPath: string, extension: string): Promise<string>;
  size(key: string): Promise<number>;
  createReadStream(key: string, range?: { start: number; end: number }): NodeJS.ReadableStream;
  remove(key: string): Promise<void>;
}

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const UPLOAD_TMP_DIR = path.join(UPLOAD_DIR, "tmp");

class LocalDiskStorage implements MediaStorage {
  constructor(private root: string) {
    fs.mkdirSync(path.join(root, "media"), { recursive: true });
    fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
  }

  // Keys are generated server-side; still refuse anything that could escape the root.
  private resolve(key: string): string {
    if (!/^media\/[a-f0-9-]+(\.[a-z0-9]+)?$/.test(key)) throw new Error("Invalid storage key");
    return path.join(this.root, key);
  }

  async saveFromPath(tmpPath: string, extension: string) {
    const ext = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
    const key = `media/${randomUUID()}${ext}`;
    await fsp.rename(tmpPath, this.resolve(key));
    return key;
  }

  async size(key: string) {
    return (await fsp.stat(this.resolve(key))).size;
  }

  createReadStream(key: string, range?: { start: number; end: number }) {
    return fs.createReadStream(this.resolve(key), range);
  }

  async remove(key: string) {
    await fsp.rm(this.resolve(key), { force: true });
  }
}

export const storage: MediaStorage = new LocalDiskStorage(UPLOAD_DIR);
