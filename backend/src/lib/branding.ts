import fsp from "node:fs/promises";

/**
 * Images shipped with the app in frontend/public/branding, taken from
 * medplusnig.com: Medplus Limited's logo and homepage banners.
 */
export const BUILTIN_IMAGES = [
  { file: "medplus-logo.png", label: "Medplus logo" },
  { file: "medplus-banner-1.webp", label: "Speak with a healthcare professional" },
  { file: "medplus-banner-2.webp", label: "MedPlus app" },
  { file: "medplus-banner-3.webp", label: "Livit C" },
  { file: "medplus-banner-4.webp", label: "Get vaccinated" },
  { file: "medplus-banner-5.webp", label: "50% off" },
  { file: "medplus-banner-6.webp", label: "Beyond announcement" },
  { file: "medplus-banner-7.webp", label: "Combo deals" },
  { file: "medplus-banner-8.webp", label: "Loyalty card" },
] as const;

export const MAX_SIGN_IN_IMAGES = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ImageRef = { kind: "builtin"; file: string } | { kind: "asset"; id: string };

/** Parses "builtin:<file>" or an uploaded image's id. Null for anything else. */
export function parseRef(ref: unknown): ImageRef | null {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("builtin:")) {
    const file = ref.slice("builtin:".length);
    return BUILTIN_IMAGES.some(b => b.file === file) ? { kind: "builtin", file } : null;
  }
  return UUID.test(ref) ? { kind: "asset", id: ref } : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function refUrl(ref: string): string | null {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  return parsed.kind === "builtin" ? `/branding/${parsed.file}` : `/api/branding/assets/${parsed.id}`;
}

/**
 * Works out the image type from the file's first bytes, not its name or the
 * browser's claim. Only JPEG, PNG and WebP are accepted; SVG is refused
 * because it can carry scripts.
 */
export async function sniffImage(filePath: string): Promise<{ mime: string; ext: string } | null> {
  const fh = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: ".jpg" };
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: ".png" };
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: ".webp" };
    return null;
  } finally {
    await fh.close();
  }
}
