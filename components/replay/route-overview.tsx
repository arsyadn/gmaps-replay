"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TripsLayer } from "@deck.gl/geo-layers";
import { MapLibreOverlay, type MapLibreOverlayProps } from "@deck.gl/maplibre";
import { Flag, MapPinned } from "lucide-react";
import Map, {
  AttributionControl,
  Marker,
  useControl,
  type MapRef,
} from "react-map-gl/maplibre";
import type { ReplayPoint } from "@/lib/types/replay";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAP_WORKER_URL = "/maplibre-gl-worker.mjs";
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const VIEWPORT_PADDING = 52;

interface RouteOverviewProps {
  points: ReplayPoint[];
  distanceKilometers: number;
}

interface TripData {
  path: [number, number][];
  timestamps: number[];
}

interface RouteBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

function DeckOverlay(props: MapLibreOverlayProps) {
  const overlay = useControl(() => new MapLibreOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
}

function getRouteBounds(points: ReplayPoint[]): RouteBounds {
  return points.reduce<RouteBounds>(
    (bounds, point) => ({
      minLng: Math.min(bounds.minLng, point.lng),
      minLat: Math.min(bounds.minLat, point.lat),
      maxLng: Math.max(bounds.maxLng, point.lng),
      maxLat: Math.max(bounds.maxLat, point.lat),
    }),
    {
      minLng: points[0].lng,
      minLat: points[0].lat,
      maxLng: points[0].lng,
      maxLat: points[0].lat,
    },
  );
}

export function RouteOverview({ points, distanceKilometers }: RouteOverviewProps) {
  const mapRef = useRef<MapRef>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const routeBounds = useMemo(() => getRouteBounds(points), [points]);
  const center = {
    lat: (routeBounds.minLat + routeBounds.maxLat) / 2,
    lng: (routeBounds.minLng + routeBounds.maxLng) / 2,
  };
  const trip = useMemo<TripData>(() => ({
    path: points.map((point) => [point.lng, point.lat]),
    timestamps: points.map((_, index) => index),
  }), [points]);
  const routeLayers = useMemo(() => {
    const currentTime = Math.max(0, points.length - 1);
    const trailLength = Math.max(1, points.length);
    return [
      new TripsLayer<TripData>({
        id: "overview-route-halo",
        data: [trip],
        getPath: (item) => item.path,
        getTimestamps: (item) => item.timestamps,
        getColor: [255, 255, 255, 235],
        currentTime,
        trailLength,
        fadeTrail: false,
        capRounded: true,
        jointRounded: true,
        widthMinPixels: 10,
        pickable: false,
      }),
      new TripsLayer<TripData>({
        id: "overview-route-core",
        data: [trip],
        getPath: (item) => item.path,
        getTimestamps: (item) => item.timestamps,
        getColor: [234, 88, 12, 255],
        currentTime,
        trailLength,
        fadeTrail: false,
        capRounded: true,
        jointRounded: true,
        widthMinPixels: 5,
        pickable: false,
      }),
    ];
  }, [points.length, trip]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !isMapReady) return;
    map.fitBounds(
      [
        [routeBounds.minLng, routeBounds.minLat],
        [routeBounds.maxLng, routeBounds.maxLat],
      ],
      { padding: VIEWPORT_PADDING, duration: 0, maxZoom: MAX_ZOOM },
    );
  }, [isMapReady, routeBounds]);

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
        role="img"
        aria-label={`Overview map of the complete ${distanceKilometers.toFixed(0)} kilometer route`}
        className="relative h-[320px] overflow-hidden bg-[#d8d6cf] sm:h-[390px]"
      >
        <div className={`absolute inset-0 z-30 grid place-items-center bg-stone-200 transition-opacity duration-500 ${isMapReady ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <div className="flex items-center gap-3 rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur">
            <span className="size-2 animate-pulse rounded-full bg-orange-600" />
            Preparing route overview
          </div>
        </div>

        <Map
          ref={mapRef}
          initialViewState={{
            longitude: center.lng,
            latitude: center.lat,
            zoom: MIN_ZOOM,
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
          style={{ width: "100%", height: "100%" }}
        >
          <DeckOverlay layers={routeLayers} />

          <Marker longitude={points[0].lng} latitude={points[0].lat} anchor="center" style={{ zIndex: 20 }}>
            <div className="size-4 rounded-full border-[4px] border-white bg-stone-950 shadow-lg" aria-label="Journey start" />
          </Marker>
          <Marker longitude={points.at(-1)!.lng} latitude={points.at(-1)!.lat} anchor="center" style={{ zIndex: 20 }}>
            <div className="size-5 rounded-full border-[4px] border-white bg-orange-600 shadow-lg" aria-label="Journey end" />
          </Marker>

          <AttributionControl compact position="bottom-right" />
        </Map>

        <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-xs font-semibold text-white shadow-xl">
          <Flag className="size-3.5 fill-current" /> Complete route
        </div>
        <p className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg bg-white/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-stone-600 shadow-sm backdrop-blur">
          {Math.abs(center.lat).toFixed(2)}°{center.lat >= 0 ? "N" : "S"}, {Math.abs(center.lng).toFixed(2)}°{center.lng >= 0 ? "E" : "W"}
        </p>
      </div>
    </section>
  );
}
