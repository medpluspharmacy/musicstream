import { useEffect, useState } from "react";

export function resolveLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/")) return logoUrl;
  if (logoUrl.startsWith("/objects/uploads/")) {
    const id = logoUrl.slice("/objects/uploads/".length);
    return `/api/storage/objects/${id}`;
  }
  return logoUrl;
}

interface BrandMarkProps {
  logoUrl: string | null;
  letter: string;
  companyName?: string;
  size: "sm" | "md" | "lg" | "xl";
  fallbackBg?: string;
}

const SIZE_MAP: Record<BrandMarkProps["size"], { box: string; text: string; rounded: string }> = {
  sm: { box: "w-7 h-7", text: "text-sm", rounded: "rounded-lg" },
  md: { box: "w-9 h-9", text: "text-lg", rounded: "rounded-xl" },
  lg: { box: "w-14 h-14", text: "text-xl", rounded: "rounded-2xl" },
  xl: { box: "w-24 h-24", text: "text-5xl font-display", rounded: "rounded-3xl" },
};

export function BrandMark({ logoUrl, letter, companyName, size, fallbackBg }: BrandMarkProps) {
  const resolved = resolveLogoUrl(logoUrl);
  const [failed, setFailed] = useState(false);
  const dims = SIZE_MAP[size];

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={companyName ?? "Logo"}
        onError={() => setFailed(true)}
        className={`${dims.box} ${dims.rounded} object-cover shrink-0 bg-muted`}
      />
    );
  }

  return (
    <div
      className={`${dims.box} ${dims.rounded} flex items-center justify-center text-white font-bold ${dims.text} shrink-0 ${fallbackBg ? "" : "bg-brand-gradient text-white"}`}
      style={fallbackBg ? { backgroundColor: fallbackBg } : undefined}
    >
      {letter}
    </div>
  );
}

/**
 * The company's logo, or its initial and name when there's no logo. Logos are
 * usually wordmarks that already contain the name, so the name isn't repeated
 * beside them. The white chip keeps dark logos visible on dark backgrounds.
 */
export function BrandLockup({ logoUrl, letter, companyName, size, textClassName = "" }: {
  logoUrl: string | null;
  letter: string;
  companyName: string;
  size: "sm" | "md" | "lg";
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUrl]);
  const height = { sm: "h-7", md: "h-10", lg: "h-14" }[size];
  if (logoUrl && !failed) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-white px-2 py-1 shadow-sm ring-1 ring-black/5 ${height}`}>
        <img src={logoUrl} alt={companyName} onError={() => setFailed(true)} className="h-full w-auto max-w-[180px] object-contain" />
      </span>
    );
  }
  const text = { sm: "text-base", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span className="inline-flex items-center gap-3 min-w-0">
      <BrandMark logoUrl={null} letter={letter} companyName={companyName} size={size} />
      <span className={`font-bold tracking-tight truncate ${text} ${textClassName}`}>{companyName}</span>
    </span>
  );
}
