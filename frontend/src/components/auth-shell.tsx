import { ReactNode, useEffect, useState } from "react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { BrandLockup } from "@/components/brand-mark";

const SLIDE_MS = 6_000;

function prefersReducedMotion() {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** The sign-in backgrounds, fading from one to the next. Holds on the first for people who prefer less motion. */
function Slideshow({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (images.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [images.join("|")]);
  return (
    <>
      {images.map((src, i) => (
        <div
          key={src}
          data-slide={i}
          data-active={i === index}
          aria-hidden
          className={`absolute inset-0 bg-cover bg-right transition-opacity duration-[1500ms] ease-in-out ${i === index ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}
    </>
  );
}

/** Split-screen frame shared by the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const images = settings.signInImages;
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-end p-12 bg-brand-gradient text-white">
        {images.length > 0 && <Slideshow images={images} />}
        {/* Darkens the bottom of the picture so the text stays readable. */}
        {images.length > 0 && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" aria-hidden />}
        <div className="relative">
          <h2 className="text-4xl font-bold max-w-md">{settings.loginHeadline}</h2>
          <p className="mt-4 max-w-md opacity-90">{settings.loginSubtext}</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLockup logoUrl={settings.logoUrl} letter={settings.logoLetter} companyName={settings.companyName} size="lg" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3">{message}</p>
  );
}
