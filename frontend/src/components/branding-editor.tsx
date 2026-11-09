import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, RotateCcw, Upload, X } from "lucide-react";
import {
  getBrandingSettings, saveBranding, uploadBrandingImage, errorMessage,
  type BrandingChoices, type BrandingImage, type BrandingSettings,
} from "@/lib";
import { resolveApiUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button, Card, Input, Label } from "@/components/shared";

const MAX_MB = 5;

/** Uploads one image and returns its library entry. */
function useImageUpload(onUploaded: (img: BrandingImage) => void) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: "Image too large", description: `Images can be up to ${MAX_MB} MB.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await uploadBrandingImage(file);
      onUploaded({ ref: res.ref, url: res.url, label: file.name, builtin: false });
    } catch (err) {
      toast({ title: "Couldn't upload the image", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  const input = <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />;
  return { input, busy, open: () => inputRef.current?.click() };
}

function Thumb({ url, label, wide = true, contain = false }: { url: string; label: string; wide?: boolean; contain?: boolean }) {
  return (
    <img
      src={resolveApiUrl(url)}
      alt={label}
      className={`${wide ? "aspect-[16/7]" : "aspect-square"} w-full rounded-lg border border-border ${contain ? "object-contain bg-white p-2" : "object-cover"}`}
    />
  );
}

/** Pick one image (or none) from the library, or upload a new one. */
function ImageSlot({ label, hint, value, library, onChange, onUploaded, contain = false }: {
  label: string;
  hint: string;
  value: string | null;
  library: BrandingImage[];
  onChange: (ref: string | null) => void;
  onUploaded: (img: BrandingImage) => void;
  contain?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const upload = useImageUpload(img => { onUploaded(img); onChange(img.ref); setOpen(false); });
  const current = library.find(i => i.ref === value);
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground -mt-1 mb-2">{hint}</p>
      <div className="flex items-start gap-3">
        <div className="w-48 shrink-0">
          {current
            ? <Thumb url={current.url} label={current.label} contain={contain} />
            : <div className="aspect-[16/7] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">None</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {upload.input}
          <Button type="button" variant="outline" size="sm" onClick={upload.open} isLoading={upload.busy}><Upload className="w-4 h-4 mr-1.5" />Upload</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <ImagePlus className="w-4 h-4 mr-1.5" />{open ? "Close" : "Choose"}
          </Button>
          {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><X className="w-4 h-4 mr-1.5" />Remove</Button>}
        </div>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" role="listbox" aria-label={`Choose ${label.toLowerCase()}`}>
          {library.map(img => (
            <button
              key={img.ref}
              type="button"
              role="option"
              aria-selected={img.ref === value}
              title={img.label}
              onClick={() => { onChange(img.ref); setOpen(false); }}
              className={`relative rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${img.ref === value ? "ring-2 ring-primary" : ""}`}
            >
              <Thumb url={img.url} label={img.label} contain={contain} />
              {img.ref === value && <Check className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground p-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Several sign-in backgrounds, in the order they fade through. */
function SlideList({ value, library, max, onChange, onUploaded }: {
  value: string[];
  library: BrandingImage[];
  max: number;
  onChange: (refs: string[]) => void;
  onUploaded: (img: BrandingImage) => void;
}) {
  const [adding, setAdding] = useState(false);
  const upload = useImageUpload(img => { onUploaded(img); onChange([...value, img.ref]); });
  const byRef = new Map(library.map(i => [i.ref, i]));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const full = value.length >= max;
  return (
    <div>
      <Label>Sign-in backgrounds</Label>
      <p className="text-xs text-muted-foreground -mt-1 mb-2">
        Shown beside the sign-in form. With several, they fade from one to the next every few seconds. Up to {max}.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {value.map((ref, i) => {
          const img = byRef.get(ref);
          return (
            <div key={ref} className="space-y-1.5">
              {img ? <Thumb url={img.url} label={img.label} /> : <div className="aspect-[16/7] rounded-lg bg-muted" />}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground tabular-nums flex-1">{i + 1}</span>
                <Button type="button" variant="ghost" size="sm" aria-label="Show earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label="Show later" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowRight className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="sm" aria-label="Remove background" onClick={() => onChange(value.filter(r => r !== ref))}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          );
        })}
        {value.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No pictures: the panel shows the MedPlus gradient.</p>}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {upload.input}
        <Button type="button" variant="outline" size="sm" onClick={upload.open} isLoading={upload.busy} disabled={full}><Upload className="w-4 h-4 mr-1.5" />Upload</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(a => !a)} disabled={full} aria-expanded={adding}>
          <Plus className="w-4 h-4 mr-1.5" />{adding ? "Close" : "Add from library"}
        </Button>
      </div>
      {adding && !full && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {library.filter(i => !value.includes(i.ref) && !i.ref.endsWith("logo.png")).map(img => (
            <button key={img.ref} type="button" title={`Add ${img.label}`} onClick={() => onChange([...value, img.ref])}
              className="rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 hover:opacity-80">
              <Thumb url={img.url} label={img.label} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function choicesOf(s: BrandingSettings | BrandingChoices): BrandingChoices {
  return { companyName: s.companyName, logo: s.logo, signInImages: s.signInImages, sidebarImage: s.sidebarImage, bannerImage: s.bannerImage };
}

/** Company name, logo and backgrounds. Super admin only; the server enforces this too. */
export function BrandingEditor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["branding-settings"], queryFn: getBrandingSettings });
  const [form, setForm] = useState<BrandingChoices | null>(null);
  const [uploaded, setUploaded] = useState<BrandingImage[]>([]);
  useEffect(() => { if (data && !form) setForm(choicesOf(data)); }, [data]);

  const save = useMutation({
    mutationFn: saveBranding,
    onSuccess: (res) => {
      qc.setQueryData(["branding-settings"], res);
      setForm(choicesOf(res));
      setUploaded([]);
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast({ title: "Branding saved", description: "Everyone sees the new look on their next page load." });
    },
    onError: (err) => toast({ title: "Couldn't save branding", description: errorMessage(err), variant: "destructive" }),
  });

  if (!data || !form) return null;
  const library = [...uploaded, ...data.library.filter(i => !uploaded.some(u => u.ref === i.ref))];
  const addUpload = (img: BrandingImage) => setUploaded(list => [img, ...list]);
  const set = (change: Partial<BrandingChoices>) => setForm(f => ({ ...f!, ...change }));
  const dirty = JSON.stringify(form) !== JSON.stringify(choicesOf(data));

  return (
    <Card className="p-5 max-w-3xl mt-6">
      <p className="font-semibold">Company branding</p>
      <p className="text-sm text-muted-foreground mt-1">
        Shown to everyone, including on the sign-in page. Images: JPEG, PNG or WebP, up to {MAX_MB} MB.
      </p>
      <form
        className="mt-5 space-y-6"
        onSubmit={e => { e.preventDefault(); save.mutate(form); }}
      >
        <div>
          <Label htmlFor="branding-company-name">Company name</Label>
          <Input id="branding-company-name" value={form.companyName} maxLength={80} required onChange={e => set({ companyName: e.target.value })} />
        </div>

        <ImageSlot
          label="Logo"
          hint="Shown in the sidebar and on the sign-in page. A wide logo with the name in it works best."
          value={form.logo}
          library={library}
          onChange={logo => set({ logo })}
          onUploaded={addUpload}
          contain
        />

        <SlideList value={form.signInImages} library={library} max={data.maxSignInImages} onChange={signInImages => set({ signInImages })} onUploaded={addUpload} />

        <div className="pt-2 border-t border-border">
          <p className="font-medium mt-4">App backgrounds</p>
          <p className="text-xs text-muted-foreground mb-4">Darkened behind the text so it stays readable.</p>
          <div className="space-y-6">
            <ImageSlot label="Sidebar" hint="Behind the menu on every page." value={form.sidebarImage} library={library} onChange={sidebarImage => set({ sidebarImage })} onUploaded={addUpload} />
            <ImageSlot label="Welcome banner" hint="Behind the welcome message on the Dashboard." value={form.bannerImage} library={library} onChange={bannerImage => set({ bannerImage })} onUploaded={addUpload} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" isLoading={save.isPending} disabled={!dirty}>Save branding</Button>
          {dirty && <Button type="button" variant="ghost" onClick={() => { setForm(choicesOf(data)); setUploaded([]); }}>Discard changes</Button>}
          <Button type="button" variant="ghost" onClick={() => set(data.defaults)}>
            <RotateCcw className="w-4 h-4 mr-1.5" />Use Medplus defaults
          </Button>
        </div>
      </form>
    </Card>
  );
}
