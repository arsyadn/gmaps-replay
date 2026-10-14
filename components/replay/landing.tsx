import { FileJson, Route, ShieldCheck, Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/replay/file-dropzone";
import { TimelineExportGuide } from "@/components/replay/timeline-export-guide";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface LandingProps {
  onFile: (file: File) => void;
  onBuiltIn: () => void;
  isLoading: boolean;
  error: string | null;
}

const features = [
  { icon: ShieldCheck, title: "Private", copy: "Never leaves this device" },
  { icon: Route, title: "Interactive", copy: "Scrub every movement" },
  { icon: FileJson, title: "Timeline ready", copy: "Semantic JSON support" },
] as const;

export function Landing({ onFile, onBuiltIn, isLoading, error }: LandingProps) {
  return (
    <main className="relative isolate flex-1 overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-36 -z-10 size-96 rounded-full bg-orange-200/35 blur-3xl" />
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-2xl">
            <Badge variant="outline" className="mb-6 gap-2 border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm">
              <Sparkles className="size-3.5 text-orange-600" /> Phase 01 · Replay engine
            </Badge>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-stone-950 sm:text-6xl lg:text-7xl">
              Your history,<br /><span className="font-serif font-normal italic text-orange-600">back in motion.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
              Turn your Google Location History into a private, cinematic replay. Export the Timeline JSON from your phone and watch every journey unfold.
            </p>
            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
              {features.map(({ icon: FeatureIcon, title, copy }) => (
                <Card key={title} className="rounded-2xl border-stone-200/80 bg-white/65 p-4 backdrop-blur-sm">
                  <FeatureIcon className="mb-3 size-4 text-orange-600" />
                  <p className="text-sm font-semibold text-stone-900">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{copy}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="relative">
            <div className="absolute -right-4 -top-5 -z-10 size-28 rounded-full border border-dashed border-orange-300" />
            <FileDropzone onFile={onFile} onBuiltIn={onBuiltIn} isLoading={isLoading} error={error} />
            <a href="#get-your-json" className="mt-4 block text-center text-sm font-semibold text-stone-500 hover:text-orange-700">
              Not sure where the JSON is? See the phone export guide ↓
            </a>
          </section>
        </div>

        <TimelineExportGuide />
      </div>
    </main>
  );
}
