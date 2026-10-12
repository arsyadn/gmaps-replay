"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  FileJson,
  Footprints,
  LockKeyhole,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FileDropzone } from "@/components/replay/file-dropzone";
import { ReplayControls } from "@/components/replay/replay-controls";
import { ReplayMap } from "@/components/replay/replay-map";
import { RouteOverview } from "@/components/replay/route-overview";
import { Button } from "@/components/ui/button";
import { parseGoogleTimelineJson } from "@/lib/parser/google-timeline";
import type { ParsedLocationHistory } from "@/lib/types/replay";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", options ?? {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return formatDate(value, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AppHeader({ hasData, onReset }: { hasData: boolean; onReset: () => void }) {
  return (
    <header className="flex h-18 items-center justify-between border-b border-stone-200/80 bg-[#f7f6f1]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
      <button type="button" className="flex items-center gap-2.5" onClick={onReset}>
        <span className="grid size-9 place-items-center rounded-xl bg-stone-950 text-white"><Route className="size-4" /></span>
        <span className="text-sm font-extrabold tracking-[0.16em] text-stone-950">TRACEBACK</span>
      </button>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:flex">
          <LockKeyhole className="size-3" /> Local only
        </span>
        {hasData ? (
          <Button variant="outline" className="h-9 rounded-full bg-white px-4" onClick={onReset}>
            <ChevronLeft className="size-3.5" /> New file
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function Landing({ onFile, onDemo, isLoading, error }: {
  onFile: (file: File) => void;
  onDemo: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <main className="relative isolate flex-1 overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-36 -z-10 size-96 rounded-full bg-orange-200/35 blur-3xl" />
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-16">
        <section className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm">
            <Sparkles className="size-3.5 text-orange-600" /> Phase 01 · Replay engine
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-stone-950 sm:text-6xl lg:text-7xl">
            Your history,<br /><span className="font-serif font-normal italic text-orange-600">back in motion.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
            Turn your Google Location History into a private, cinematic replay. Upload your Takeout JSON and watch every journey unfold.
          </p>
          <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "Private", "Never leaves this device"],
              [Route, "Interactive", "Scrub every movement"],
              [FileJson, "Takeout ready", "Semantic JSON support"],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof ShieldCheck;
              return (
                <div key={String(title)} className="rounded-2xl border border-stone-200/80 bg-white/65 p-4 backdrop-blur-sm">
                  <FeatureIcon className="mb-3 size-4 text-orange-600" />
                  <p className="text-sm font-semibold text-stone-900">{String(title)}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{String(copy)}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="relative">
          <div className="absolute -right-4 -top-5 -z-10 size-28 rounded-full border border-dashed border-orange-300" />
          <FileDropzone onFile={onFile} onDemo={onDemo} isLoading={isLoading} error={error} />
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value }: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">{label}</p>
        <Icon className="size-4 text-orange-600" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
    </div>
  );
}

function ReplayWorkspace({ data, onReset }: { data: ParsedLocationHistory; onReset: () => void }) {
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const overviewRef = useRef<HTMLDivElement>(null);
  const wasCompleteRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const currentIndex = Math.min(data.points.length - 1, Math.floor(position));
  const currentPoint = data.points[currentIndex];
  const nextPoint = data.points[Math.min(data.points.length - 1, currentIndex + 1)];
  const positionFraction = position - currentIndex;
  const currentTimestamp = new Date(
    Date.parse(currentPoint.timestamp) +
    (Date.parse(nextPoint.timestamp) - Date.parse(currentPoint.timestamp)) * positionFraction,
  ).toISOString();
  const isComplete = position >= data.points.length - 1;

  useEffect(() => {
    let frame: number | undefined;
    if (isComplete && !wasCompleteRef.current) {
      frame = window.requestAnimationFrame(() => {
        overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    wasCompleteRef.current = isComplete;
    return () => { if (frame !== undefined) window.cancelAnimationFrame(frame); };
  }, [isComplete]);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame: number;
    let previousTime = performance.now();
    const finalPosition = data.points.length - 1;

    const animate = (now: number) => {
      const elapsed = Math.min(64, now - previousTime);
      previousTime = now;
      const nextPosition = Math.min(
        finalPosition,
        positionRef.current + (elapsed / 650) * speed,
      );
      positionRef.current = nextPosition;
      setPosition(nextPosition);

      if (nextPosition >= finalPosition) {
        setIsPlaying(false);
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [data.points.length, isPlaying, speed]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-orange-700">REPLAY READY</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">Your location story</h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
          <FileJson className="size-4 text-stone-800" />
          <span className="max-w-44 truncate font-semibold text-stone-800">{data.fileName}</span>
          <span>· {formatSize(data.fileSizeBytes)}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col gap-4">
          <section className="flex min-h-[600px] flex-col overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-[0_24px_65px_-46px_rgba(28,25,23,0.6)]">
            <ReplayMap points={data.points} position={position} />
            <ReplayControls
              position={position}
              total={data.points.length}
              isPlaying={isPlaying}
              speed={speed}
              currentTime={formatDateTime(currentTimestamp)}
              onPositionChange={(nextPosition) => {
                positionRef.current = nextPosition;
                setPosition(nextPosition);
                setIsPlaying(false);
              }}
              onPlayToggle={() => {
                if (position >= data.points.length - 1) {
                  positionRef.current = 0;
                  setPosition(0);
                }
                setIsPlaying((value) => !value);
              }}
              onSpeedChange={setSpeed}
              onReset={() => {
                positionRef.current = 0;
                setPosition(0);
                setIsPlaying(false);
              }}
            />
          </section>
          {isComplete ? (
            <div ref={overviewRef} className="scroll-mt-5">
              <RouteOverview
                points={data.points}
                distanceKilometers={data.summary.distanceMeters / 1000}
              />
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard icon={Route} label="Distance" value={`${(data.summary.distanceMeters / 1000).toFixed(0)} km`} />
            <SummaryCard icon={MapPin} label="Visits" value={data.summary.visits.toLocaleString()} />
            <SummaryCard icon={CalendarDays} label="Active days" value={data.summary.days.toLocaleString()} />
            <SummaryCard icon={Footprints} label="Track points" value={data.points.length.toLocaleString()} />
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Date range</p>
            <div className="mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-stone-800">
              <span>{formatDate(data.summary.startTime)}</span>
              <span className="h-px flex-1 bg-stone-200" />
              <span>{formatDate(data.summary.endTime)}</span>
            </div>
          </div>

          <div className="flex-1 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Movement mix</p>
              <span className="text-xs text-stone-400">{data.sourceRecords} records</span>
            </div>
            <div className="mt-4 space-y-3">
              {data.activities.slice(0, 5).map((activity, index) => {
                const maximum = data.activities[0]?.count || 1;
                return (
                  <div key={activity.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-700">{activity.label}</span>
                      <span className="tabular-nums text-stone-400">{activity.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${index === 0 ? "bg-orange-600" : "bg-stone-400"}`} style={{ width: `${Math.max(8, (activity.count / maximum) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={onReset} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950">
            Load a different history
          </button>
        </aside>
      </div>
    </main>
  );
}

export function ReplayApp() {
  const [data, setData] = useState<ParsedLocationHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseText = (text: string, name: string, size: number) => {
    setData(parseGoogleTimelineJson(text, name, size));
  };

  const loadFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please choose a .json file from Google Takeout.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("That file is larger than 50 MB. Split the export by year and try again.");
      return;
    }
    setIsLoading(true);
    try {
      parseText(await file.text(), file.name, file.size);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We could not read that file.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemo = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/location-history.json");
      if (!response.ok) throw new Error("The demo file is unavailable.");
      const text = await response.text();
      parseText(text, "location-history.json", new Blob([text]).size);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The demo could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => { setData(null); setError(null); };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f1] text-stone-950">
      <AppHeader hasData={Boolean(data)} onReset={reset} />
      {data ? <ReplayWorkspace data={data} onReset={reset} /> : <Landing onFile={loadFile} onDemo={loadDemo} isLoading={isLoading} error={error} />}
    </div>
  );
}
