import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import { Op } from "sequelize";
import { Branding, BrandingAsset } from "../models/index.js";
import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { BUILTIN_IMAGES, MAX_SIGN_IN_IMAGES, parseRef, refUrl, sniffImage } from "../lib/branding.js";
import StorageController from "./StorageController.js";

// Uploaded but never saved images are deleted after this long.
const UNSAVED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  companyName: "Medplus Limited",
  logo: "builtin:medplus-logo.png",
  signInImages: ["builtin:medplus-banner-1.webp", "builtin:medplus-banner-2.webp", "builtin:medplus-banner-3.webp", "builtin:medplus-banner-4.webp"],
  sidebarImage: "builtin:medplus-banner-6.webp",
  bannerImage: "builtin:medplus-banner-1.webp",
};

async function row() {
  const [b] = await Branding.findOrCreate({ where: { id: 1 }, defaults: { id: 1, ...DEFAULTS } });
  return b;
}

function refsIn(b: { logo: string | null; signInImages: string[]; sidebarImage: string | null; bannerImage: string | null }) {
  return [b.logo, ...b.signInImages, b.sidebarImage, b.bannerImage].filter((r): r is string => !!r);
}

function assetIds(refs: string[]) {
  return refs.map(parseRef).flatMap(r => (r?.kind === "asset" ? [r.id] : []));
}

export default class BrandingController {
  /** What every page needs, including the sign-in page, so it's public. */
  static async publicSettings() {
    const b = await row();
    return {
      companyName: b.companyName,
      logoUrl: b.logo ? refUrl(b.logo) : null,
      signInImages: b.signInImages.map(refUrl).filter((u): u is string => !!u),
      sidebarImage: b.sidebarImage ? refUrl(b.sidebarImage) : null,
      bannerImage: b.bannerImage ? refUrl(b.bannerImage) : null,
    };
  }

  /** The editable settings, with the images to choose from. */
  static async adminSettings() {
    const b = await row();
    const uploads = await BrandingAsset.findAll({ order: [["createdAt", "DESC"]] });
    return {
      companyName: b.companyName,
      logo: b.logo,
      signInImages: b.signInImages,
      sidebarImage: b.sidebarImage,
      bannerImage: b.bannerImage,
      maxSignInImages: MAX_SIGN_IN_IMAGES,
      library: [
        ...uploads.map(a => ({ ref: a.id, url: refUrl(a.id)!, label: "Uploaded image", builtin: false })),
        ...BUILTIN_IMAGES.map(i => ({ ref: `builtin:${i.file}`, url: refUrl(`builtin:${i.file}`)!, label: i.label, builtin: true })),
      ],
      defaults: DEFAULTS,
    };
  }

  static async save(input: Record<string, unknown>) {
    const name = typeof input.companyName === "string" ? input.companyName.trim() : "";
    if (!name || name.length > 80) throw new HttpError(400, "Enter a company name of up to 80 characters");

    const one = async (value: unknown, label: string): Promise<string | null> => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = parseRef(value);
      if (!parsed) throw new HttpError(400, `Choose a valid image for the ${label}`);
      if (parsed.kind === "asset" && !(await BrandingAsset.findByPk(parsed.id))) throw new HttpError(400, `The ${label} image no longer exists`);
      return value as string;
    };
    if (!Array.isArray(input.signInImages)) throw new HttpError(400, "signInImages must be a list");
    if (input.signInImages.length > MAX_SIGN_IN_IMAGES) throw new HttpError(400, `Use up to ${MAX_SIGN_IN_IMAGES} sign-in backgrounds`);
    const signInImages: string[] = [];
    for (const v of input.signInImages) {
      const ref = await one(v, "sign-in background");
      if (ref && !signInImages.includes(ref)) signInImages.push(ref);
    }

    const next = {
      companyName: name,
      logo: await one(input.logo, "logo"),
      signInImages,
      sidebarImage: await one(input.sidebarImage, "sidebar background"),
      bannerImage: await one(input.bannerImage, "welcome banner background"),
    };

    const b = await row();
    const before = new Set(assetIds(refsIn(b)));
    await b.update({ ...next, updatedAt: new Date() });

    // Delete uploads that were in use and no longer are, and old ones never saved.
    const keep = new Set(assetIds(refsIn(next)));
    const stale = await BrandingAsset.findAll({
      where: { id: { [Op.notIn]: keep.size ? [...keep] : ["00000000-0000-0000-0000-000000000000"] } },
    });
    for (const a of stale) {
      if (!before.has(a.id) && Date.now() - a.createdAt.getTime() < UNSAVED_UPLOAD_TTL_MS) continue;
      try {
        await (await StorageController.forBackend(a.storageBackendId)).remove(a.storageKey);
        await a.destroy();
      } catch (err) {
        logger.warn({ err, id: a.id }, "Couldn't delete an unused branding image");
      }
    }
    return BrandingController.adminSettings();
  }

  /** Stores an uploaded image once its contents prove it's a JPEG, PNG or WebP. */
  static async upload(file: { path: string; size: number }) {
    try {
      const type = await sniffImage(file.path);
      if (!type) throw new HttpError(400, "Upload a JPEG, PNG or WebP image");
      const { storage, backendId } = await StorageController.forUpload();
      const storageKey = await storage.saveFromPath(file.path, type.ext, type.mime);
      const asset = await BrandingAsset.create({
        id: randomUUID(), storageKey, storageBackendId: backendId, mimeType: type.mime, sizeBytes: file.size,
      });
      return { ref: asset.id, url: refUrl(asset.id)! };
    } finally {
      await fsp.rm(file.path, { force: true });
    }
  }

  static async openAsset(id: string) {
    const asset = await BrandingAsset.findByPk(id);
    if (!asset) return null;
    const storage = await StorageController.forBackend(asset.storageBackendId);
    return { asset, stream: await storage.openReadStream(asset.storageKey) };
  }
}
