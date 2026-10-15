"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { TripsLayer } from "@deck.gl/geo-layers";
import { MapLibreOverlay, type MapLibreOverlayProps } from "@deck.gl/maplibre";
import {
  CalendarDays,
  Download,
  Flag,
  Footprints,
  LoaderCircle,
  MapPin,
  MapPinned,
  Route,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "radix-ui";
import type { Map as MapLibreMap } from "maplibre-gl";
import Map, {
  AttributionControl,
  Marker,
  useControl,
  type MapRef,
} from "react-map-gl/maplibre";
import { getMovementVisual } from "@/components/replay/replay-map";
import { Button } from "@/components/ui/button";
import type { ParsedLocationHistory, ReplayPoint } from "@/lib/types/replay";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAP_WORKER_URL = "/maplibre-gl-worker.mjs";
const MIN_ZOOM = 2;
const MAX_ZOOM = 15;
const VIEWPORT_PADDING = 52;
const EXPORTED_MOVEMENT_LIMIT = 5;

interface RouteOverviewProps {
  data: ParsedLocationHistory;
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

interface JourneyMapProps {
  mapId: string;
  points: ReplayPoint[];
  distanceKilometers: number;
  routeBounds: RouteBounds;
  center: { lat: number; lng: number };
  mapRef?: RefObject<MapRef | null>;
  className: string;
  onIdle?: () => void;
}

function DeckOverlay(props: MapLibreOverlayProps) {
  const overlay = useControl(() => new MapLibreOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
}

function isRecoverableTileAbort(message: string) {
  return message.includes("Failed to fetch (0)") &&
    message.includes("tiles.openfreemap.org/planet/");
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

function fitMapToJourney(map: MapLibreMap, routeBounds: RouteBounds) {
  const isNarrowMap = map.getContainer().clientWidth < 640;
  map.fitBounds(
    [
      [routeBounds.minLng, routeBounds.minLat],
      [routeBounds.maxLng, routeBounds.maxLat],
    ],
    {
      padding: isNarrowMap ? 32 : VIEWPORT_PADDING,
      duration: 0,
      maxZoom: MAX_ZOOM,
    },
  );
}

function waitForMapIdle(map: MapLibreMap) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      map.off("idle", finish);
      window.clearTimeout(timeout);
      resolve();
    };

    map.once("idle", finish);
    const timeout = window.setTimeout(finish, 1_500);
    map.triggerRepaint();
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatFilenameDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ExportStat({ icon: Icon, label, value }: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">{label}</p>
        <Icon className="size-3.5 text-orange-600" />
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-stone-950">{value}</p>
    </div>
  );
}

function JourneyMap({
  mapId,
  points,
  distanceKilometers,
  routeBounds,
  center,
  mapRef,
  className,
  onIdle,
}: JourneyMapProps) {
  const internalMapRef = useRef<MapRef>(null);
  const activeMapRef = mapRef ?? internalMapRef;
  const [isMapReady, setIsMapReady] = useState(false);
  const trip = useMemo<TripData>(() => ({
    path: points.map((point) => [point.lng, point.lat]),
    timestamps: points.map((_, index) => index),
  }), [points]);
  const routeLayers = useMemo(() => {
    const currentTime = Math.max(0, points.length - 1);
    const trailLength = Math.max(1, points.length);
    return [
      new TripsLayer<TripData>({
        id: `${mapId}-route-halo`,
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
        id: `${mapId}-route-core`,
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
  }, [mapId, points.length, trip]);

  return (
    <div
      role="img"
      aria-label={`Overview map of the complete ${distanceKilometers.toFixed(0)} kilometer route`}
      className={`relative overflow-hidden bg-[#d8d6cf] ${className}`}
    >
      <div className={`absolute inset-0 z-30 grid place-items-center bg-stone-200 transition-opacity duration-500 ${isMapReady ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-3 rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur">
          <span className="size-2 animate-pulse rounded-full bg-orange-600" />
          Preparing route overview
        </div>
      </div>

      <Map
        ref={activeMapRef}
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: MIN_ZOOM, pitch: 0, bearing: 0 }}
        mapStyle={MAP_STYLE}
        workerUrl={MAP_WORKER_URL}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        minPitch={0}
        maxPitch={0}
        canvasContextAttributes={{ antialias: true, preserveDrawingBuffer: true }}
        attributionControl={false}
        renderWorldCopies={false}
        dragRotate={false}
        touchPitch={false}
        onLoad={(event) => {
          event.target.touchZoomRotate.disableRotation();
          fitMapToJourney(event.target, routeBounds);
          setIsMapReady(true);
        }}
        onResize={(event) => fitMapToJourney(event.target, routeBounds)}
        onIdle={onIdle}
        onError={(event) => {
          if (!isRecoverableTileAbort(event.error.message)) {
            console.error("Map rendering error", event.error);
          }
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
        <AttributionControl compact={false} position="bottom-right" />
      </Map>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-xs font-semibold text-white shadow-xl">
        <Flag className="size-3.5 fill-current" /> Complete route
      </div>
      <p className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg bg-white/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-stone-600 shadow-sm backdrop-blur">
        {Math.abs(center.lat).toFixed(2)}&deg;{center.lat >= 0 ? "N" : "S"}, {Math.abs(center.lng).toFixed(2)}&deg;{center.lng >= 0 ? "E" : "W"}
      </p>
    </div>
  );
}

export function RouteOverview({ data }: RouteOverviewProps) {
  const { points, summary } = data;
  const distanceKilometers = summary.distanceMeters / 1000;
  const shareMapRef = useRef<MapRef>(null);
  const exportRef = useRef<HTMLElement>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isShareMapIdle, setIsShareMapIdle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const routeBounds = useMemo(() => getRouteBounds(points), [points]);
  const center = {
    lat: (routeBounds.minLat + routeBounds.maxLat) / 2,
    lng: (routeBounds.minLng + routeBounds.maxLng) / 2,
  };
  const movementCount = data.activities.reduce((total, activity) => total + activity.count, 0);
  const exportedMovements = data.activities.slice(0, EXPORTED_MOVEMENT_LIMIT);

  const savePhoto = async () => {
    const exportNode = exportRef.current;
    const map = shareMapRef.current?.getMap();
    if (!exportNode || !map || !isShareMapIdle || isSaving) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      map.resize();
      fitMapToJourney(map, routeBounds);
      await waitForMapIdle(map);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      }));
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(exportNode, {
        backgroundColor: "#f7f6f1",
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === "true"),
      });
      const download = document.createElement("a");
      download.download = `traceback-${formatFilenameDate(summary.startTime)}-${formatFilenameDate(summary.endTime)}.png`;
      download.href = dataUrl;
      download.click();
    } catch (error) {
      console.error("Unable to save journey photo", error);
      setSaveError("Could not save the photo. Wait for the map to finish loading and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-[0_24px_65px_-46px_rgba(28,25,23,0.6)] duration-700">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-orange-600">
              <MapPinned className="size-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">Replay complete</p>
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">Your whole journey</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="hidden gap-4 sm:flex">
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-stone-400">Distance</p>
                <p className="mt-1 text-xs font-semibold text-stone-900">{distanceKilometers.toFixed(0)} km</p>
              </div>
              <span className="w-px bg-stone-200" />
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-stone-400">Points</p>
                <p className="mt-1 text-xs font-semibold text-stone-900">{points.length.toLocaleString()}</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setSaveError(null);
                setIsShareMapIdle(false);
                setIsShareOpen(true);
              }}
              className="h-10 rounded-full bg-orange-600 px-4 text-white hover:bg-orange-700"
            >
              <Share2 />
              Share / Save Photo
            </Button>
          </div>
        </div>
        <JourneyMap
          mapId="overview"
          points={points}
          distanceKilometers={distanceKilometers}
          routeBounds={routeBounds}
          center={center}
          className="h-[320px] sm:h-[390px]"
        />
      </section>

      <Dialog.Root
        open={isShareOpen}
        onOpenChange={(open) => {
          if (isSaving) return;
          setIsShareOpen(open);
          if (!open) setSaveError(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[1200px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[1.75rem] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <Dialog.Description className="sr-only">
              Preview your complete journey, review its movement mix, and save it as a photo.
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Close share preview" disabled={isSaving} className="fixed right-3 top-3 z-[80] rounded-full border-white/70 bg-white/95 text-stone-700 shadow-lg hover:bg-white">
                <X />
              </Button>
            </Dialog.Close>

            <article ref={exportRef} className="w-full overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-2xl">
              <div className="flex flex-col items-start justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-orange-600">
                    <MapPinned className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">Replay complete</p>
                    <Dialog.Title className="text-lg font-semibold tracking-tight text-stone-950">Your whole journey</Dialog.Title>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-stone-400">Timeline</p>
                    <p className="mt-1 text-xs font-semibold text-stone-700">{formatDate(summary.startTime)} - {formatDate(summary.endTime)}</p>
                  </div>
                  <Button
                    data-export-ignore="true"
                    type="button"
                    onClick={savePhoto}
                    disabled={!isShareMapIdle || isSaving}
                    className="h-10 rounded-full bg-orange-600 px-5 text-white hover:bg-orange-700"
                  >
                    {isSaving ? <LoaderCircle className="animate-spin" /> : <Download />}
                    {isSaving ? "Saving..." : "Save photo"}
                  </Button>
                </div>
              </div>

              <div className="grid bg-[#f7f6f1] lg:grid-cols-[minmax(0,1fr)_360px]">
                <JourneyMap
                  mapId="share"
                  points={points}
                  distanceKilometers={distanceKilometers}
                  routeBounds={routeBounds}
                  center={center}
                  mapRef={shareMapRef}
                  className="h-[340px] border-b border-stone-200 sm:h-[430px] lg:h-[580px] lg:border-b-0 lg:border-r"
                  onIdle={() => setIsShareMapIdle(true)}
                />

                <aside className="p-4">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.17em] text-stone-400">Journey legend</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ExportStat icon={Route} label="Distance" value={`${distanceKilometers.toFixed(0)} km`} />
                    <ExportStat icon={MapPin} label="Visits" value={summary.visits.toLocaleString()} />
                    <ExportStat icon={CalendarDays} label="Active days" value={summary.days.toLocaleString()} />
                    <ExportStat icon={Footprints} label="Track points" value={points.length.toLocaleString()} />
                  </div>

                  <div className="mt-2 rounded-2xl border border-stone-200 bg-white p-3.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Timeline</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-stone-800">
                      <span>{formatDate(summary.startTime)}</span>
                      <span className="h-px flex-1 bg-stone-200" />
                      <span>{formatDate(summary.endTime)}</span>
                    </div>
                  </div>

                  <div className="mt-2 rounded-2xl border border-stone-200 bg-white p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">Movement mix</p>
                      <span className="text-[9px] font-semibold text-stone-400">{data.activities.length} modes / {movementCount.toLocaleString()} movements</span>
                    </div>
                    {exportedMovements.length ? (
                      <div className="mt-3 space-y-2.5">
                        {exportedMovements.map((activity) => {
                          const percentage = movementCount > 0 ? (activity.count / movementCount) * 100 : 0;
                          const visual = getMovementVisual(activity.label, "activity");
                          return (
                            <div key={activity.label}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-stone-700">
                                  <span aria-hidden="true">{visual.emoji}</span>
                                  <span className="truncate">{activity.label}</span>
                                </span>
                                <span className="shrink-0 tabular-nums text-stone-400">
                                  <strong className="text-stone-700">{activity.count}&times;</strong> / {percentage.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                                <div className={`h-full rounded-full ${visual.markerClassName}`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {data.activities.length > EXPORTED_MOVEMENT_LIMIT ? (
                          <p className="text-[9px] font-medium text-stone-400">+{data.activities.length - EXPORTED_MOVEMENT_LIMIT} more movement modes</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-stone-500">No movement modes were included in this timeline export.</p>
                    )}
                  </div>
                </aside>
              </div>
            </article>

            {saveError ? (
              <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-lg">{saveError}</p>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
