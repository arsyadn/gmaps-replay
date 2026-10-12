"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import {
  fromWorld,
  getVisibleTiles,
  projectToViewport,
  TILE_SIZE,
  toWorld,
} from "@/lib/map/mercator";
import type { GeoPoint, ReplayPoint } from "@/lib/types/replay";

const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

interface Size { width: number; height: number }

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

interface ReplayMapProps {
  points: ReplayPoint[];
  position: number;
}

function catmullRom(a: number, b: number, c: number, d: number, amount: number) {
  const amountSquared = amount * amount;
  const amountCubed = amountSquared * amount;
  return 0.5 * (
    2 * b +
    (-a + c) * amount +
    (2 * a - 5 * b + 4 * c - d) * amountSquared +
    (-a + 3 * b - 3 * c + d) * amountCubed
  );
}

function interpolatePoint(points: ReplayPoint[], position: number): ReplayPoint {
  const index = Math.min(points.length - 1, Math.floor(position));
  const nextIndex = Math.min(points.length - 1, index + 1);
  const amount = Math.max(0, Math.min(1, position - index));
  const previous = points[Math.max(0, index - 1)];
  const current = points[index];
  const next = points[nextIndex];
  const following = points[Math.min(points.length - 1, nextIndex + 1)];

  return {
    ...current,
    id: `interpolated-${index}`,
    lat: catmullRom(previous.lat, current.lat, next.lat, following.lat, amount),
    lng: catmullRom(previous.lng, current.lng, next.lng, following.lng, amount),
    timestamp: new Date(
      Date.parse(current.timestamp) +
      (Date.parse(next.timestamp) - Date.parse(current.timestamp)) * amount,
    ).toISOString(),
  };
}

export function ReplayMap({ points, position }: ReplayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; center: GeoPoint } | null>(null);
  const currentIndex = Math.min(points.length - 1, Math.floor(position));
  const currentPoint = interpolatePoint(points, position);
  const [size, setSize] = useState<Size>({ width: 900, height: 600 });
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState<GeoPoint>(points[0]);
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = TILE_SIZE * 2 ** zoom;
  const mapCenter = isFollowing ? currentPoint : center;
  const centerWorld = toWorld(mapCenter);

  const project = (point: GeoPoint) => projectToViewport(point, centerWorld, zoom, size);

  const tiles = getVisibleTiles(centerWorld, zoom, size);

  const screenPoints = points.map(project);
  const interpolatedMarker = project(currentPoint);
  const visitedScreenPoints = [...screenPoints.slice(0, currentIndex + 1), interpolatedMarker];
  const upcomingScreenPoints = [interpolatedMarker, ...screenPoints.slice(currentIndex + 1)];
  const visitedPath = visitedScreenPoints
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const upcomingPath = upcomingScreenPoints
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const marker = interpolatedMarker;
  const firstMarker = project(points[0]);

  const panFromDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const world = toWorld(drag.center);
    setCenter(fromWorld({
      x: world.x - (clientX - drag.x) / scale,
      y: world.y - (clientY - drag.y) / scale,
    }));
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-[420px] flex-1 cursor-grab overflow-hidden bg-[#e8e6df] active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, center: mapCenter };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        setIsFollowing(false);
        panFromDrag(event.clientX, event.clientY);
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <div className="absolute inset-0">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="absolute size-64 bg-cover bg-center"
            style={{ left: tile.left, top: tile.top, backgroundImage: `url(${tile.url})` }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-stone-950/[0.03]" />
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <path d={upcomingPath} fill="none" stroke="#78716c" strokeOpacity="0.35" strokeWidth="4" strokeDasharray="3 10" strokeLinecap="round" />
        <path d={visitedPath} fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={visitedPath} fill="none" stroke="#ea580c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={firstMarker.x} cy={firstMarker.y} r="6" fill="#1c1917" stroke="white" strokeWidth="3" />
      </svg>

      <div
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
        style={{ left: marker.x, top: marker.y }}
      >
        <div className="mb-2 whitespace-nowrap rounded-xl bg-stone-950 px-3 py-2 text-xs font-semibold text-white shadow-xl">
          {currentPoint.label}
        </div>
        <div className="relative mx-auto grid size-11 place-items-center rounded-full border-4 border-white bg-orange-600 text-white shadow-xl">
          <MapPin className="size-5 fill-current" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-orange-500/35" />
        </div>
      </div>

      <div className="absolute left-4 top-4 rounded-2xl border border-white/70 bg-white/90 px-3.5 py-3 shadow-lg backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Current position</p>
        <p className="mt-1 font-mono text-xs font-semibold text-stone-800">
          {formatCoordinate(currentPoint.lat, "N", "S")}, {formatCoordinate(currentPoint.lng, "E", "W")}
        </p>
      </div>

      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          <button type="button" aria-label="Zoom in" className="grid size-10 place-items-center text-stone-700 hover:bg-stone-100" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))}><Plus className="size-4" /></button>
          <div className="h-px bg-stone-200" />
          <button type="button" aria-label="Zoom out" className="grid size-10 place-items-center text-stone-700 hover:bg-stone-100" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))}><Minus className="size-4" /></button>
        </div>
        <button
          type="button"
          aria-label="Follow current position"
          aria-pressed={isFollowing}
          className={`grid size-10 place-items-center rounded-xl border shadow-lg transition ${isFollowing ? "border-orange-600 bg-orange-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-100"}`}
          onClick={() => { setIsFollowing(true); setCenter(currentPoint); }}
        >
          <LocateFixed className="size-4" />
        </button>
      </div>

      <a className="absolute bottom-1 right-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] text-stone-600" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    </div>
  );
}
