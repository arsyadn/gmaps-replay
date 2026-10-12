"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, MapPinned } from "lucide-react";
import {
  fromWorld,
  getVisibleTiles,
  projectToViewport,
  toWorld,
  type MapSize,
} from "@/lib/map/mercator";
import type { ReplayPoint } from "@/lib/types/replay";

const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const VIEWPORT_PADDING = 56;

interface RouteOverviewProps {
  points: ReplayPoint[];
  distanceKilometers: number;
}

export function RouteOverview({ points, distanceKilometers }: RouteOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<MapSize>({ width: 900, height: 390 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => {
    const worldPoints = points.map(toWorld);
    const minX = Math.min(...worldPoints.map((point) => point.x));
    const maxX = Math.max(...worldPoints.map((point) => point.x));
    const minY = Math.min(...worldPoints.map((point) => point.y));
    const maxY = Math.max(...worldPoints.map((point) => point.y));
    const availableWidth = Math.max(1, size.width - VIEWPORT_PADDING * 2);
    const availableHeight = Math.max(1, size.height - VIEWPORT_PADDING * 2);
    const longitudeScale = (maxX - minX) > 0 ? availableWidth / ((maxX - minX) * 256) : 2 ** MAX_ZOOM;
    const latitudeScale = (maxY - minY) > 0 ? availableHeight / ((maxY - minY) * 256) : 2 ** MAX_ZOOM;
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.floor(Math.log2(Math.min(longitudeScale, latitudeScale)))),
    );
    const centerWorld = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    return { centerWorld, zoom };
  }, [points, size.height, size.width]);

  const tiles = useMemo(
    () => getVisibleTiles(view.centerWorld, view.zoom, size),
    [size, view],
  );
  const screenPoints = points.map((point) =>
    projectToViewport(point, view.centerWorld, view.zoom, size),
  );
  const routePath = screenPoints
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const start = screenPoints[0];
  const end = screenPoints.at(-1)!;
  const center = fromWorld(view.centerWorld);

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-[0_24px_65px_-46px_rgba(28,25,23,0.6)] duration-700">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-orange-600"><MapPinned className="size-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">Replay complete</p>
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Your whole journey</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div><p className="text-[10px] uppercase tracking-wider text-stone-400">Distance</p><p className="text-sm font-bold text-stone-900">{distanceKilometers.toFixed(0)} km</p></div>
          <div className="h-8 w-px bg-stone-200" />
          <div><p className="text-[10px] uppercase tracking-wider text-stone-400">Points</p><p className="text-sm font-bold text-stone-900">{points.length.toLocaleString()}</p></div>
        </div>
      </div>

      <div
        ref={containerRef}
        role="img"
        aria-label={`Overview map of the complete ${distanceKilometers.toFixed(0)} kilometer route`}
        className="relative h-[320px] overflow-hidden bg-[#e8e6df] sm:h-[390px]"
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="absolute size-64 bg-cover bg-center"
            style={{ left: tile.left, top: tile.top, backgroundImage: `url(${tile.url})` }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-stone-950/[0.04]" />
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <path d={routePath} fill="none" stroke="white" strokeOpacity="0.92" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={routePath} fill="none" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={start.x} cy={start.y} r="8" fill="#1c1917" stroke="white" strokeWidth="4" />
          <circle cx={end.x} cy={end.y} r="9" fill="#ea580c" stroke="white" strokeWidth="4" />
        </svg>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-xs font-semibold text-white shadow-xl">
          <Flag className="size-3.5 fill-current" /> Complete route
        </div>
        <p className="absolute right-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-stone-600 shadow-sm backdrop-blur">
          {Math.abs(center.lat).toFixed(2)}°{center.lat >= 0 ? "N" : "S"}, {Math.abs(center.lng).toFixed(2)}°{center.lng >= 0 ? "E" : "W"}
        </p>
        <a className="absolute bottom-1 right-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] text-stone-600" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </div>
    </section>
  );
}
