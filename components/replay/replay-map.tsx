"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TripsLayer } from "@deck.gl/geo-layers";
import { MapLibreOverlay, type MapLibreOverlayProps } from "@deck.gl/maplibre";
import {
  Bike,
  BusFront,
  CarFront,
  Footprints,
  LocateFixed,
  MapPin,
  Minus,
  Motorbike,
  Navigation,
  Plane,
  Plus,
  Ship,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import Map, {
  AttributionControl,
  Marker,
  useControl,
  type MapRef,
} from "react-map-gl/maplibre";
import { Button } from "@/components/ui/button";
import type { GeoPoint, ReplayPoint } from "@/lib/types/replay";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAP_WORKER_URL = "/maplibre-gl-worker.mjs";
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const CAMERA_POSITION_RESPONSE_MS = 90;

interface ReplayMapProps {
  points: ReplayPoint[];
  position: number;
}

interface TripData {
  path: [number, number][];
  timestamps: number[];
}

interface MovementVisual {
  icon: LucideIcon;
  label: string;
  markerClassName: string;
  pulseClassName: string;
  headingOffset?: number;
  followsHeading?: boolean;
}

function DeckOverlay(props: MapLibreOverlayProps) {
  const overlay = useControl(() => new MapLibreOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
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

function createSmoothTrip(points: ReplayPoint[]): TripData {
  const path: [number, number][] = [];
  const timestamps: number[] = [];
  const samplesPerSegment = points.length > 1_000
    ? 2
    : points.length > 400
      ? 3
      : points.length > 150
        ? 4
        : points.length > 60 ? 6 : 8;

  for (let index = 0; index < points.length - 1; index += 1) {
    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const amount = sample / samplesPerSegment;
      const point = interpolatePoint(points, index + amount);
      path.push([point.lng, point.lat]);
      timestamps.push(index + amount);
    }
  }

  const finalPoint = points.at(-1)!;
  path.push([finalPoint.lng, finalPoint.lat]);
  timestamps.push(points.length - 1);
  return { path, timestamps };
}

function bearingBetween(from: GeoPoint, to: GeoPoint) {
  if (Math.abs(from.lat - to.lat) < 1e-8 && Math.abs(from.lng - to.lng) < 1e-8) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeFrom = radians(from.lat);
  const latitudeTo = radians(to.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeTo);
  const x =
    Math.cos(latitudeFrom) * Math.sin(latitudeTo) -
    Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function findActivityType(points: ReplayPoint[], position: number) {
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(position)));
  const current = points[index];
  const next = points[Math.min(points.length - 1, index + 1)];
  if (current.activityType) return current.activityType;
  if (next.activityType) return next.activityType;

  for (let distance = 1; distance < points.length; distance += 1) {
    const previous = points[index - distance];
    if (previous?.activityType) return previous.activityType;
    if (previous?.kind === "visit") break;
  }

  return undefined;
}

function getMovementVisual(activityType: string | undefined, pointKind: ReplayPoint["kind"]): MovementVisual {
  const normalized = activityType?.toLowerCase() ?? "";

  if (/\b(bus|coach)\b/.test(normalized)) {
    return { icon: BusFront, label: activityType ?? "Bus", markerClassName: "bg-blue-600 shadow-[0_8px_30px_rgba(37,99,235,0.42)]", pulseClassName: "bg-blue-500/35", followsHeading: true };
  }
  if (/motor|scooter|moped|two.?wheel/.test(normalized)) {
    return { icon: Motorbike, label: activityType ?? "Motorcycle", markerClassName: "bg-amber-500 shadow-[0_8px_30px_rgba(245,158,11,0.42)]", pulseClassName: "bg-amber-400/35" };
  }
  if (/plane|airplane|flying|flight|air travel/.test(normalized)) {
    return { icon: Plane, label: activityType ?? "Flight", markerClassName: "bg-sky-600 shadow-[0_8px_30px_rgba(2,132,199,0.42)]", pulseClassName: "bg-sky-500/35", followsHeading: true, headingOffset: -45 };
  }
  if (/walk|foot|pedestrian|hiking|running/.test(normalized)) {
    return { icon: Footprints, label: activityType ?? "Walking", markerClassName: "bg-emerald-600 shadow-[0_8px_30px_rgba(5,150,105,0.42)]", pulseClassName: "bg-emerald-500/35", followsHeading: true };
  }
  if (/bicy|cycling|bike/.test(normalized)) {
    return { icon: Bike, label: activityType ?? "Cycling", markerClassName: "bg-lime-600 shadow-[0_8px_30px_rgba(101,163,13,0.42)]", pulseClassName: "bg-lime-500/35" };
  }
  if (/train|rail|subway|metro|tram/.test(normalized)) {
    return { icon: TrainFront, label: activityType ?? "Train", markerClassName: "bg-violet-600 shadow-[0_8px_30px_rgba(124,58,237,0.42)]", pulseClassName: "bg-violet-500/35", followsHeading: true };
  }
  if (/boat|ferry|ship|sailing/.test(normalized)) {
    return { icon: Ship, label: activityType ?? "Boat", markerClassName: "bg-cyan-600 shadow-[0_8px_30px_rgba(8,145,178,0.42)]", pulseClassName: "bg-cyan-500/35", followsHeading: true };
  }
  if (/car|vehicle|driv|taxi|automobile/.test(normalized)) {
    return { icon: CarFront, label: activityType ?? "Driving", markerClassName: "bg-orange-600 shadow-[0_8px_30px_rgba(234,88,12,0.45)]", pulseClassName: "bg-orange-500/35", followsHeading: true };
  }
  if (pointKind === "visit") {
    return { icon: MapPin, label: "Visited place", markerClassName: "bg-rose-600 shadow-[0_8px_30px_rgba(225,29,72,0.4)]", pulseClassName: "bg-rose-500/35" };
  }
  return { icon: Navigation, label: activityType ?? "Moving", markerClassName: "bg-orange-600 shadow-[0_8px_30px_rgba(234,88,12,0.45)]", pulseClassName: "bg-orange-500/35", followsHeading: true };
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

export function ReplayMap({ points, position }: ReplayMapProps) {
  const mapRef = useRef<MapRef>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const cameraTargetRef = useRef<GeoPoint>({
    lat: points[0].lat,
    lng: points[0].lng,
  });
  const [isFollowing, setIsFollowing] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const finalPosition = points.length - 1;
  const currentPoint = interpolatePoint(points, position);
  const lookAheadPoint = interpolatePoint(points, Math.min(finalPosition, position + 0.16));
  const activityType = findActivityType(points, position);
  const movement = getMovementVisual(activityType, currentPoint.kind);
  const MovementIcon = movement.icon;
  const routeBearing = bearingBetween(currentPoint, lookAheadPoint) ?? 0;
  const markerBearing = routeBearing + (movement.headingOffset ?? 0);
  const markerLabel = activityType ?? (currentPoint.label === "Timeline point" ? movement.label : currentPoint.label);
  const trip = useMemo(() => createSmoothTrip(points), [points]);

  const animatedLayers = useMemo(() => {
    const trailLength = Math.max(1.5, Math.min(12, points.length * 0.18));
    return [
      new TripsLayer<TripData>({
        id: "journey-history-core",
        data: [trip],
        getPath: (item) => item.path,
        getTimestamps: (item) => item.timestamps,
        getColor: [249, 115, 22, 235],
        currentTime: position,
        fadeTrail: false,
        capRounded: true,
        jointRounded: true,
        widthMinPixels: 5,
        pickable: false,
      }),
      new TripsLayer<TripData>({
        id: "journey-aura",
        data: [trip],
        getPath: (item) => item.path,
        getTimestamps: (item) => item.timestamps,
        getColor: [249, 115, 22, 80],
        currentTime: position,
        trailLength,
        fadeTrail: true,
        capRounded: true,
        jointRounded: true,
        widthMinPixels: 15,
        pickable: false,
      }),
      new TripsLayer<TripData>({
        id: "journey-core",
        data: [trip],
        getPath: (item) => item.path,
        getTimestamps: (item) => item.timestamps,
        getColor: [255, 237, 213, 255],
        currentTime: position,
        trailLength: Math.max(0.8, trailLength * 0.48),
        fadeTrail: true,
        capRounded: true,
        jointRounded: true,
        widthMinPixels: 4,
        pickable: false,
      }),
    ];
  }, [points.length, position, trip]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    cameraTargetRef.current = {
      lat: currentPoint.lat,
      lng: currentPoint.lng,
    };

    if (!map || !isMapReady || !isFollowing || cameraFrameRef.current !== null) return;

    let previousTime = performance.now();
    const animateCamera = (now: number) => {
      const activeMap = mapRef.current?.getMap();
      if (!activeMap) {
        cameraFrameRef.current = null;
        return;
      }

      const elapsed = Math.min(50, now - previousTime);
      previousTime = now;
      const positionBlend = 1 - Math.exp(-elapsed / CAMERA_POSITION_RESPONSE_MS);
      const target = cameraTargetRef.current;
      const center = activeMap.getCenter();
      const longitudeDelta = shortestAngleDelta(center.lng, target.lng);
      const latitudeDelta = target.lat - center.lat;

      activeMap.jumpTo({
        center: [
          center.lng + longitudeDelta * positionBlend,
          center.lat + latitudeDelta * positionBlend,
        ],
      });

      const hasSettled =
        Math.abs(longitudeDelta) < 1e-7 &&
        Math.abs(latitudeDelta) < 1e-7;
      if (hasSettled) {
        cameraFrameRef.current = null;
        return;
      }
      cameraFrameRef.current = window.requestAnimationFrame(animateCamera);
    };

    cameraFrameRef.current = window.requestAnimationFrame(animateCamera);
  }, [
    currentPoint,
    isFollowing,
    isMapReady,
  ]);

  useEffect(() => () => {
    if (cameraFrameRef.current !== null) window.cancelAnimationFrame(cameraFrameRef.current);
  }, []);

  const stopFollowing = () => {
    if (cameraFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
    setIsFollowing(false);
  };

  const changeZoom = (amount: number) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.easeTo({
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, map.getZoom() + amount)),
      duration: 320,
    });
  };

  return (
    <div className="relative min-h-[420px] flex-1 overflow-hidden bg-[#d8d6cf]">
      <div className={`absolute inset-0 grid place-items-center bg-stone-200 transition-opacity duration-700 ${isMapReady ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur">
          <span className="size-2 animate-pulse rounded-full bg-orange-600" />
          Preparing your journey
        </div>
      </div>

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: points[0].lng,
          latitude: points[0].lat,
          zoom: 13.5,
          pitch: 0,
          bearing: 0,
        }}
        mapStyle={MAP_STYLE}
        workerUrl={MAP_WORKER_URL}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        minPitch={0}
        maxPitch={0}
        canvasContextAttributes={{ antialias: true }}
        attributionControl={false}
        renderWorldCopies={false}
        dragRotate={false}
        touchPitch={false}
        onLoad={(event) => {
          event.target.touchZoomRotate.disableRotation();
            event.target
              .getContainer()
              .querySelector(".maplibregl-ctrl-attrib")
              ?.classList.remove("maplibregl-compact-show");
          setIsMapReady(true);
        }}
        onDragStart={stopFollowing}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={animatedLayers} />

        <Marker longitude={points[0].lng} latitude={points[0].lat} anchor="center">
          <div className="size-3 rounded-full border-[3px] border-white bg-stone-950 shadow-md" aria-label="Journey start" />
        </Marker>
        {position >= finalPosition ? (
          <Marker longitude={points.at(-1)!.lng} latitude={points.at(-1)!.lat} anchor="center">
            <div className="size-3 rounded-full border-[3px] border-white bg-orange-600 shadow-md" aria-label="Journey end" />
          </Marker>
        ) : null}
        <Marker
          longitude={currentPoint.lng}
          latitude={currentPoint.lat}
          anchor="bottom"
          style={{ zIndex: 50 }}
        >
          <div className="pointer-events-none relative z-50 isolate flex flex-col items-center">
            <div className="mb-2 max-w-52 truncate rounded-xl border border-white/25 bg-stone-950 px-3 py-2 text-xs font-semibold text-white shadow-2xl">
              {markerLabel}
            </div>
            <div className={`relative grid size-12 place-items-center rounded-full border-4 border-white text-white ${movement.markerClassName}`}>
              <MovementIcon
                className="size-5"
                style={movement.followsHeading ? { transform: `rotate(${markerBearing}deg)` } : undefined}
              />
              <span className={`absolute inset-0 -z-10 animate-ping rounded-full ${movement.pulseClassName}`} />
            </div>
          </div>
        </Marker>

        <AttributionControl compact position="bottom-right" />
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-8rem)] rounded-2xl border border-white/70 bg-white/88 px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-600" />
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-700">Live journey</p>
        </div>
        <p className="truncate text-sm font-bold text-stone-900">{markerLabel}</p>
        <p className="mt-1 font-mono text-[10px] font-semibold text-stone-500">
          {formatCoordinate(currentPoint.lat, "N", "S")} · {formatCoordinate(currentPoint.lng, "E", "W")}
        </p>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-xl backdrop-blur-xl">
          <Button type="button" variant="ghost" size="icon-lg" aria-label="Zoom in" className="size-10 rounded-none text-stone-700" onClick={() => changeZoom(1)}>
            <Plus className="size-4" />
          </Button>
          <div className="h-px bg-stone-200" />
          <Button type="button" variant="ghost" size="icon-lg" aria-label="Zoom out" className="size-10 rounded-none text-stone-700" onClick={() => changeZoom(-1)}>
            <Minus className="size-4" />
          </Button>
        </div>

        <Button
          type="button"
          aria-label="Follow current position"
          aria-pressed={isFollowing}
          variant={isFollowing ? "default" : "outline"}
          size="icon-lg"
          className={`size-10 rounded-xl border-white/70 shadow-xl backdrop-blur-xl ${isFollowing ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-white/90 text-stone-700"}`}
          onClick={() => setIsFollowing(true)}
        >
          <LocateFixed className="size-4" />
        </Button>
      </div>
    </div>
  );
}
