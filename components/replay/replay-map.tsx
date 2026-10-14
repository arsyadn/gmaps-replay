"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TripsLayer } from "@deck.gl/geo-layers";
import { MapLibreOverlay, type MapLibreOverlayProps } from "@deck.gl/maplibre";
import {
  LocateFixed,
  Minus,
  Plus,
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
const DEFAULT_FOLLOW_ZOOM = 13.5;
const CAMERA_POSITION_RESPONSE_MS = 90;
const CAMERA_ZOOM_OUT_RESPONSE_MS = 320;
const CAMERA_ZOOM_IN_RESPONSE_MS = 1_200;
const LONG_JUMP_THRESHOLD_KM = 5;
const STATIONARY_THRESHOLD_KM = 0.02;
const CAMERA_LOOKAHEAD_SEGMENTS = 3;
const FLIGHT_MIN_DISTANCE_KM = 100;
const POST_FLIGHT_HANDOFF_MAX_SEGMENTS = 8;
const ZOOM_FIRST_TOLERANCE = 0.35;

interface ReplayMapProps {
  points: ReplayPoint[];
  position: number;
}

interface TripData {
  path: [number, number][];
  timestamps: number[];
}

interface MovementVisual {
  emoji: string;
  label: string;
  markerClassName: string;
  pulseClassName: string;
}

interface CameraTarget extends GeoPoint {
  zoom: number;
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

function isFlightActivity(activityType: string | undefined) {
  const normalized = activityType
    ?.replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() ?? "";

  return /plane|airplane|flying|flight|air travel/.test(normalized);
}

function segmentActivityType(current: ReplayPoint, next: ReplayPoint) {
  return next.activityType ?? current.activityType;
}

function interpolatePoint(points: ReplayPoint[], position: number): ReplayPoint {
  const index = Math.min(points.length - 1, Math.floor(position));
  const nextIndex = Math.min(points.length - 1, index + 1);
  const amount = Math.max(0, Math.min(1, position - index));
  const previous = points[Math.max(0, index - 1)];
  const current = points[index];
  const next = points[nextIndex];
  const following = points[Math.min(points.length - 1, nextIndex + 1)];
  const segmentDistance = distanceKilometers(current, next);
  const isStationary = segmentDistance < STATIONARY_THRESHOLD_KM;
  const isLongJump = segmentDistance >= LONG_JUMP_THRESHOLD_KM;
  const isFlight = isFlightActivity(segmentActivityType(current, next));
  const travelAmount = isFlight
    ? (1 - Math.cos(Math.PI * amount)) / 2
    : amount;

  return {
    ...current,
    id: `interpolated-${index}`,
    lat: isStationary
      ? current.lat
      : isLongJump
      ? current.lat + (next.lat - current.lat) * travelAmount
      : catmullRom(previous.lat, current.lat, next.lat, following.lat, travelAmount),
    lng: isStationary
      ? current.lng
      : isLongJump
      ? current.lng + shortestAngleDelta(current.lng, next.lng) * travelAmount
      : catmullRom(previous.lng, current.lng, next.lng, following.lng, travelAmount),
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

function findActivityType(points: ReplayPoint[], position: number) {
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(position)));
  const current = points[index];
  const next = points[Math.min(points.length - 1, index + 1)];
  // The segment leading into the next point belongs to the next activity.
  // This matters when two consecutive activities share an endpoint.
  if (next.activityType) return next.activityType;
  if (current.activityType) return current.activityType;

  for (let distance = 1; distance < points.length; distance += 1) {
    const previous = points[index - distance];
    if (previous?.activityType) return previous.activityType;
    if (previous?.kind === "visit") break;
  }

  return undefined;
}

function formatActivityLabel(activityType: string | undefined, fallback: string) {
  if (!activityType) return fallback;
  return activityType
    .replaceAll("_", " ")
    .replace(/^in\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getMovementVisual(activityType: string | undefined, pointKind: ReplayPoint["kind"]): MovementVisual {
  const normalized = activityType
    ?.replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() ?? "";

  if (/cable\s?car|gondola|funicular/.test(normalized)) {
    return { emoji: "🚡", label: formatActivityLabel(activityType, "Cable car"), markerClassName: "bg-gradient-to-br from-pink-400 via-fuchsia-500 to-purple-600 shadow-[0_8px_30px_rgba(192,38,211,0.48)]", pulseClassName: "bg-fuchsia-400/45" };
  }
  if (/subway|metro|underground/.test(normalized)) {
    return { emoji: "🚇", label: formatActivityLabel(activityType, "Subway"), markerClassName: "bg-gradient-to-br from-indigo-400 via-indigo-600 to-violet-700 shadow-[0_8px_30px_rgba(79,70,229,0.48)]", pulseClassName: "bg-indigo-400/45" };
  }
  if (/tram|streetcar|light rail/.test(normalized)) {
    return { emoji: "🚊", label: formatActivityLabel(activityType, "Tram"), markerClassName: "bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-600 shadow-[0_8px_30px_rgba(147,51,234,0.48)]", pulseClassName: "bg-violet-400/45" };
  }
  if (/train|rail/.test(normalized)) {
    return { emoji: "🚆", label: formatActivityLabel(activityType, "Train"), markerClassName: "bg-gradient-to-br from-purple-400 via-violet-600 to-indigo-700 shadow-[0_8px_30px_rgba(124,58,237,0.48)]", pulseClassName: "bg-violet-400/45" };
  }
  if (/\b(bus|coach)\b/.test(normalized)) {
    return { emoji: "🚌", label: formatActivityLabel(activityType, "Bus"), markerClassName: "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_8px_30px_rgba(37,99,235,0.48)]", pulseClassName: "bg-blue-400/45" };
  }
  if (/taxi|\bcab\b|rideshare/.test(normalized)) {
    return { emoji: "🚕", label: formatActivityLabel(activityType, "Taxi"), markerClassName: "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 shadow-[0_8px_30px_rgba(245,158,11,0.5)]", pulseClassName: "bg-amber-300/50" };
  }
  if (/motor|scooter|moped|two.?wheel/.test(normalized)) {
    return { emoji: "🏍️", label: formatActivityLabel(activityType, "Motorcycle"), markerClassName: "bg-gradient-to-br from-amber-300 via-orange-500 to-red-600 shadow-[0_8px_30px_rgba(249,115,22,0.5)]", pulseClassName: "bg-orange-400/45" };
  }
  if (/plane|airplane|flying|flight|air travel/.test(normalized)) {
    return { emoji: "✈️", label: formatActivityLabel(activityType, "Flight"), markerClassName: "bg-gradient-to-br from-sky-300 via-cyan-500 to-blue-600 shadow-[0_8px_30px_rgba(14,165,233,0.48)]", pulseClassName: "bg-sky-300/50" };
  }
  if (/kayak|canoe|paddle/.test(normalized)) {
    return { emoji: "🛶", label: formatActivityLabel(activityType, "Kayaking"), markerClassName: "bg-gradient-to-br from-teal-300 via-cyan-500 to-blue-600 shadow-[0_8px_30px_rgba(6,182,212,0.48)]", pulseClassName: "bg-cyan-300/50" };
  }
  if (/sail/.test(normalized)) {
    return { emoji: "⛵", label: formatActivityLabel(activityType, "Sailing"), markerClassName: "bg-gradient-to-br from-emerald-300 via-teal-500 to-cyan-600 shadow-[0_8px_30px_rgba(20,184,166,0.48)]", pulseClassName: "bg-teal-300/50" };
  }
  if (/ferry/.test(normalized)) {
    return { emoji: "⛴️", label: formatActivityLabel(activityType, "Ferry"), markerClassName: "bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 shadow-[0_8px_30px_rgba(14,165,233,0.48)]", pulseClassName: "bg-cyan-300/50" };
  }
  if (/boat|ship|watercraft/.test(normalized)) {
    return { emoji: "🚤", label: formatActivityLabel(activityType, "Boat"), markerClassName: "bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-600 shadow-[0_8px_30px_rgba(59,130,246,0.48)]", pulseClassName: "bg-blue-300/50" };
  }
  if (/bicy|cycling|\bbike\b/.test(normalized)) {
    return { emoji: "🚲", label: formatActivityLabel(activityType, "Cycling"), markerClassName: "bg-gradient-to-br from-lime-300 via-green-500 to-emerald-600 shadow-[0_8px_30px_rgba(34,197,94,0.48)]", pulseClassName: "bg-lime-300/50" };
  }
  if (/hiking|trekking/.test(normalized)) {
    return { emoji: "🥾", label: formatActivityLabel(activityType, "Hiking"), markerClassName: "bg-gradient-to-br from-lime-300 via-emerald-500 to-teal-700 shadow-[0_8px_30px_rgba(16,185,129,0.48)]", pulseClassName: "bg-emerald-300/50" };
  }
  if (/running|jogging/.test(normalized)) {
    return { emoji: "🏃", label: formatActivityLabel(activityType, "Running"), markerClassName: "bg-gradient-to-br from-green-300 via-emerald-500 to-teal-600 shadow-[0_8px_30px_rgba(16,185,129,0.48)]", pulseClassName: "bg-green-300/50" };
  }
  if (/walk|foot|pedestrian/.test(normalized)) {
    return { emoji: "🚶", label: formatActivityLabel(activityType, "Walking"), markerClassName: "bg-gradient-to-br from-emerald-300 via-green-500 to-teal-600 shadow-[0_8px_30px_rgba(5,150,105,0.48)]", pulseClassName: "bg-emerald-300/50" };
  }
  if (/car|vehicle|driv|automobile/.test(normalized)) {
    return { emoji: "🚗", label: formatActivityLabel(activityType, "Driving"), markerClassName: "bg-gradient-to-br from-rose-400 via-red-500 to-red-700 shadow-[0_8px_30px_rgba(239,68,68,0.5)]", pulseClassName: "bg-red-400/45" };
  }
  if (pointKind === "visit") {
    return { emoji: "📍", label: "Visited place", markerClassName: "bg-gradient-to-br from-sky-400 via-blue-600 to-violet-700 shadow-[0_8px_30px_rgba(79,70,229,0.5)]", pulseClassName: "bg-blue-400/45" };
  }
  return { emoji: "🧭", label: formatActivityLabel(activityType, "Moving"), markerClassName: "bg-gradient-to-br from-teal-300 via-cyan-500 to-indigo-600 shadow-[0_8px_30px_rgba(6,182,212,0.5)]", pulseClassName: "bg-teal-300/50" };
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function distanceKilometers(from: GeoPoint, to: GeoPoint) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(shortestAngleDelta(from.lng, to.lng));
  const latitudeFrom = toRadians(from.lat);
  const latitudeTo = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeFrom) * Math.cos(latitudeTo) *
    Math.sin(longitudeDelta / 2) ** 2;
  const clampedHaversine = Math.max(0, Math.min(1, haversine));

  return 6_371 * 2 * Math.atan2(
    Math.sqrt(clampedHaversine),
    Math.sqrt(1 - clampedHaversine),
  );
}

function smoothstep(start: number, end: number, value: number) {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

function zoomForDistance(distance: number, preferredZoom: number) {
  if (distance < LONG_JUMP_THRESHOLD_KM) return preferredZoom;
  const distanceZoom = DEFAULT_FOLLOW_ZOOM - Math.log2(distance / 4);
  return Math.max(MIN_ZOOM, Math.min(preferredZoom, distanceZoom));
}

function postFlightHandoffZoom(
  points: ReplayPoint[],
  position: number,
  preferredZoom: number,
) {
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(position)));
  const earliestFlightIndex = Math.max(
    0,
    index - POST_FLIGHT_HANDOFF_MAX_SEGMENTS - 1,
  );

  for (let flightIndex = index; flightIndex >= earliestFlightIndex; flightIndex -= 1) {
    const flightEndIndex = flightIndex + 1;
    if (flightEndIndex >= points.length) continue;

    const flightDistance = distanceKilometers(
      points[flightIndex],
      points[flightEndIndex],
    );
    if (
      flightDistance < FLIGHT_MIN_DISTANCE_KM ||
      !isFlightActivity(segmentActivityType(points[flightIndex], points[flightEndIndex]))
    ) {
      continue;
    }

    const maximumHandoffEndIndex = Math.min(
      points.length - 1,
      flightEndIndex + POST_FLIGHT_HANDOFF_MAX_SEGMENTS,
    );
    let handoffEndIndex = maximumHandoffEndIndex;
    let hasMovedAfterLanding = false;
    for (
      let segmentIndex = flightEndIndex;
      segmentIndex < maximumHandoffEndIndex;
      segmentIndex += 1
    ) {
      const segmentDistance = distanceKilometers(
        points[segmentIndex],
        points[segmentIndex + 1],
      );
      if (hasMovedAfterLanding && segmentDistance < STATIONARY_THRESHOLD_KM) {
        handoffEndIndex = segmentIndex;
        break;
      }
      if (segmentDistance >= STATIONARY_THRESHOLD_KM) {
        hasMovedAfterLanding = true;
      }
      if (hasMovedAfterLanding && points[segmentIndex + 1].kind === "visit") {
        handoffEndIndex = segmentIndex + 1;
        break;
      }
    }

    // A visit or the first stationary segment after moving marks the stop.
    // From there the regular lookahead can prepare the next, separate journey.
    if (position < flightEndIndex || position >= handoffEndIndex) return null;

    let routeZoom = preferredZoom;
    for (
      let segmentIndex = flightEndIndex;
      segmentIndex < handoffEndIndex;
      segmentIndex += 1
    ) {
      routeZoom = Math.min(
        routeZoom,
        zoomForDistance(
          distanceKilometers(points[segmentIndex], points[segmentIndex + 1]),
          preferredZoom,
        ),
      );
    }
    return routeZoom;
  }

  return null;
}

function adaptiveCameraZoom(points: ReplayPoint[], position: number, preferredZoom: number) {
  if (position <= 0 || points.length < 2) return preferredZoom;

  const handoffZoom = postFlightHandoffZoom(points, position, preferredZoom);
  if (handoffZoom !== null) return handoffZoom;

  const index = Math.min(points.length - 1, Math.max(0, Math.floor(position)));
  const progress = Math.max(0, Math.min(1, position - index));
  let targetZoom = preferredZoom;

  for (let offset = 0; offset <= CAMERA_LOOKAHEAD_SEGMENTS; offset += 1) {
    const startIndex = index + offset;
    const endIndex = startIndex + 1;
    if (endIndex >= points.length) break;

    const distance = distanceKilometers(points[startIndex], points[endIndex]);
    const distanceZoom = zoomForDistance(distance, preferredZoom);
    if (distanceZoom >= preferredZoom) continue;

    const influence = offset === 0
      // Stay wide during travel, then settle in only when almost at the destination.
      ? 1 - smoothstep(0.78, 1, progress)
      // Begin preparing up to three segments before the next long movement.
      : smoothstep(
        0,
        1,
        (CAMERA_LOOKAHEAD_SEGMENTS - (offset - progress)) /
        CAMERA_LOOKAHEAD_SEGMENTS,
      );
    const preparedZoom = preferredZoom + (distanceZoom - preferredZoom) * influence;
    targetZoom = Math.min(targetZoom, preparedZoom);
  }

  return targetZoom;
}

function isRecoverableTileAbort(message: string) {
  return message.includes("Failed to fetch (0)") &&
    message.includes("tiles.openfreemap.org/planet/");
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

export function ReplayMap({ points, position }: ReplayMapProps) {
  const mapRef = useRef<MapRef>(null);
  const cameraFrameRef = useRef<number | null>(null);
  const preferredZoomRef = useRef(DEFAULT_FOLLOW_ZOOM);
  const cameraTargetRef = useRef<CameraTarget>({
    lat: points[0].lat,
    lng: points[0].lng,
    zoom: DEFAULT_FOLLOW_ZOOM,
  });
  const [isFollowing, setIsFollowing] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const finalPosition = points.length - 1;
  const currentPoint = interpolatePoint(points, position);
  const activityType = findActivityType(points, position);
  const movement = getMovementVisual(activityType, currentPoint.kind);
  const markerLabel = currentPoint.kind === "visit" ? currentPoint.label : movement.label;
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
      zoom: adaptiveCameraZoom(points, position, preferredZoomRef.current),
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
      const target = cameraTargetRef.current;
      const center = activeMap.getCenter();
      const longitudeDelta = shortestAngleDelta(center.lng, target.lng);
      const latitudeDelta = target.lat - center.lat;
      const distanceToTarget = distanceKilometers(
        { lat: center.lat, lng: center.lng },
        target,
      );
      const positionResponseMs =
        CAMERA_POSITION_RESPONSE_MS + Math.min(450, distanceToTarget * 0.5);
      const motionSafeZoom = Math.min(
        target.zoom,
        zoomForDistance(distanceToTarget, preferredZoomRef.current),
      );
      const zoomDelta = motionSafeZoom - activeMap.getZoom();
      const zoomResponseMs = zoomDelta > 0
        ? CAMERA_ZOOM_IN_RESPONSE_MS
        : CAMERA_ZOOM_OUT_RESPONSE_MS;
      const zoomBlend = 1 - Math.exp(-elapsed / zoomResponseMs);
      const isWaitingForSafeZoom =
        distanceToTarget >= LONG_JUMP_THRESHOLD_KM &&
        activeMap.getZoom() > motionSafeZoom + ZOOM_FIRST_TOLERANCE;
      const positionBlend = isWaitingForSafeZoom
        ? 0
        : 1 - Math.exp(-elapsed / positionResponseMs);

      activeMap.jumpTo({
        center: [
          center.lng + longitudeDelta * positionBlend,
          center.lat + latitudeDelta * positionBlend,
        ],
        zoom: activeMap.getZoom() + zoomDelta * zoomBlend,
      });

      const hasSettled =
        Math.abs(longitudeDelta) < 1e-7 &&
        Math.abs(latitudeDelta) < 1e-7 &&
        Math.abs(zoomDelta) < 1e-3;
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
    points,
    position,
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
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, map.getZoom() + amount));
    preferredZoomRef.current = nextZoom;
    cameraTargetRef.current.zoom = adaptiveCameraZoom(points, position, nextZoom);
    map.easeTo({
      zoom: nextZoom,
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
          zoom: DEFAULT_FOLLOW_ZOOM,
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
        onError={(event) => {
          if (!isRecoverableTileAbort(event.error.message)) {
            console.error("Map rendering error", event.error);
          }
        }}
        onZoomEnd={(event) => {
          if (event.originalEvent) preferredZoomRef.current = event.target.getZoom();
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={animatedLayers} />

        <Marker longitude={points[0].lng} latitude={points[0].lat} anchor="center">
          <div className="size-3 rounded-full border-[3px] border-white bg-emerald-500 shadow-md" aria-label="Journey start" />
        </Marker>
        {position >= finalPosition ? (
          <Marker longitude={points.at(-1)!.lng} latitude={points.at(-1)!.lat} anchor="center">
            <div className="size-3 rounded-full border-[3px] border-white bg-violet-600 shadow-md" aria-label="Journey end" />
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
              <span
                aria-hidden="true"
                className="select-none text-[1.55rem] leading-none drop-shadow-sm"
              >
                {movement.emoji}
              </span>
              <span className={`absolute inset-0 -z-10 animate-ping rounded-full ${movement.pulseClassName}`} />
            </div>
          </div>
        </Marker>

        <AttributionControl compact position="bottom-right" />
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-8rem)] rounded-2xl border border-white/70 bg-white/88 px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="relative grid size-6 place-items-center">
            <span className={`absolute inset-0 rounded-full ${movement.markerClassName}`} />
            <span className="relative text-sm leading-none" aria-hidden="true">{movement.emoji}</span>
          </span>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-stone-600">Live journey</p>
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
