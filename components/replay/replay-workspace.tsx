"use client";

import { useEffect, useRef, useState } from "react";
import { FileJson } from "lucide-react";
import { ReplayControls } from "@/components/replay/replay-controls";
import { ReplayMap } from "@/components/replay/replay-map";
import { ReplaySidebar } from "@/components/replay/replay-sidebar";
import { RouteOverview } from "@/components/replay/route-overview";
import type { ParsedLocationHistory } from "@/lib/types/replay";

const BASE_SEGMENT_DURATION_MS = 1_400;
const MAX_DISTANCE_DURATION_MS = 4_600;
const FLIGHT_SEGMENT_DURATION_MS = 8_500;
const FLIGHT_MIN_DISTANCE_KM = 100;

interface PlaybackPoint {
  lat: number;
  lng: number;
  activityType?: string;
}

interface ReplayWorkspaceProps {
  data: ParsedLocationHistory;
  onReset: () => void;
  onChangeDateRange: () => void;
}

function isFlightActivity(activityType: string | undefined) {
  const normalized = activityType
    ?.replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() ?? "";

  return /plane|airplane|flying|flight|air travel/.test(normalized);
}

function distanceKilometers(from: PlaybackPoint, to: PlaybackPoint) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) *
    Math.sin(longitudeDelta / 2) ** 2;
  const clampedHaversine = Math.max(0, Math.min(1, haversine));

  return 6_371 * 2 * Math.atan2(
    Math.sqrt(clampedHaversine),
    Math.sqrt(1 - clampedHaversine),
  );
}

function segmentDurationMilliseconds(from: PlaybackPoint, to: PlaybackPoint) {
  const distance = distanceKilometers(from, to);
  const activityType = to.activityType ?? from.activityType;
  if (distance >= FLIGHT_MIN_DISTANCE_KM && isFlightActivity(activityType)) {
    return FLIGHT_SEGMENT_DURATION_MS;
  }
  const distanceDuration = Math.log2(1 + distance) * 550;
  return BASE_SEGMENT_DURATION_MS + Math.min(MAX_DISTANCE_DURATION_MS, distanceDuration);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReplayWorkspace({ data, onReset, onChangeDateRange }: ReplayWorkspaceProps) {
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const overviewRef = useRef<HTMLDivElement>(null);
  const wasCompleteRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const finalPosition = data.points.length - 1;
  const safePosition = Number.isFinite(position)
    ? Math.max(0, Math.min(finalPosition, position))
    : 0;
  const currentIndex = Math.floor(safePosition);
  const currentPoint = data.points[currentIndex];
  const nextPoint = data.points[Math.min(finalPosition, currentIndex + 1)];
  const positionFraction = safePosition - currentIndex;
  const currentTimestamp = new Date(
    Date.parse(currentPoint.timestamp) +
    (Date.parse(nextPoint.timestamp) - Date.parse(currentPoint.timestamp)) * positionFraction,
  ).toISOString();
  const isComplete = safePosition >= finalPosition;

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

    const animate = (now: number) => {
      const elapsed = Math.min(64, now - previousTime);
      previousTime = now;
      const activeIndex = Math.min(
        finalPosition,
        Math.max(0, Math.floor(positionRef.current)),
      );
      const segmentEndIndex = Math.min(finalPosition, activeIndex + 1);
      const segmentDuration = segmentDurationMilliseconds(
        data.points[activeIndex],
        data.points[segmentEndIndex],
      );
      const nextPosition = Math.min(
        finalPosition,
        positionRef.current + (elapsed / segmentDuration) * speed,
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
  }, [data.points, finalPosition, isPlaying, speed]);

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
            <ReplayMap points={data.points} position={safePosition} />
            <ReplayControls
              position={safePosition}
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
                if (safePosition >= finalPosition) {
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
                data={data}
              />
            </div>
          ) : null}
        </div>

        <ReplaySidebar
          data={data}
          onReset={onReset}
          onChangeDateRange={onChangeDateRange}
        />
      </div>
    </main>
  );
}
