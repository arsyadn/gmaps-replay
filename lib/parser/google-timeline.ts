import type {
  ActivityBreakdown,
  GeoPoint,
  ParsedLocationHistory,
  ReplayPoint,
} from "@/lib/types/replay";

type UnknownRecord = Record<string, unknown>;
const EARTH_RADIUS_METERS = 6_371_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

export function parseGeoString(value: unknown): GeoPoint | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^geo:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function parseLegacyLocation(value: unknown): GeoPoint | null {
  const location = asRecord(value);
  if (!location) return null;
  const latitude = asNumber(location.latitude);
  const longitude = asNumber(location.longitude);
  if (latitude !== undefined && longitude !== undefined) return { lat: latitude, lng: longitude };
  const latitudeE7 = asNumber(location.latitudeE7);
  const longitudeE7 = asNumber(location.longitudeE7);
  if (latitudeE7 !== undefined && longitudeE7 !== undefined) {
    return { lat: latitudeE7 / 1e7, lng: longitudeE7 / 1e7 };
  }
  return null;
}

function toTimestamp(value: unknown, fallback?: string): string | null {
  if (typeof value === "number" || (typeof value === "string" && /^\d{10,13}$/.test(value))) {
    const numeric = Number(value);
    const date = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback ?? null;
}

function distanceBetween(a: GeoPoint, b: GeoPoint): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function prettifyActivity(value?: string): string {
  if (!value) return "Moving";
  return value
    .replaceAll("_", " ")
    .replace(/^in /i, "")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenTimelineObjects(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  const root = asRecord(input);
  if (!root) return [];
  if (Array.isArray(root.timelineObjects)) return root.timelineObjects;
  if (Array.isArray(root.semanticSegments)) return root.semanticSegments;
  return Object.values(root).flatMap((value) => (Array.isArray(value) ? value : []));
}

function readDuration(record: UnknownRecord): { start: string | null; end: string | null } {
  const duration = asRecord(record.duration);
  const start = toTimestamp(record.startTime ?? duration?.startTimestamp ?? duration?.startTimestampMs);
  const end = toTimestamp(record.endTime ?? duration?.endTimestamp ?? duration?.endTimestampMs, start ?? undefined);
  return { start, end };
}

function createPoint(
  coordinate: GeoPoint | null,
  timestamp: string | null,
  input: Omit<ReplayPoint, keyof GeoPoint | "timestamp">,
): ReplayPoint | null {
  return coordinate && timestamp ? { ...coordinate, timestamp, ...input } : null;
}

/** Parse current Semantic Timeline exports and the older timelineObjects format. */
export function parseGoogleTimelineJson(
  jsonText: string,
  fileName = "location-history.json",
  fileSizeBytes = new Blob([jsonText]).size,
): ParsedLocationHistory {
  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON error";
    throw new Error(`This file is not valid JSON. ${detail}`);
  }

  const records = flattenTimelineObjects(json);
  if (!records.length) throw new Error("No timeline records were found in this file.");

  const points: ReplayPoint[] = [];
  const activities = new Map<string, ActivityBreakdown>();
  let visits = 0;
  let activityDistance = 0;

  records.forEach((rawRecord, recordIndex) => {
    const record = asRecord(rawRecord);
    if (!record) return;
    const recordDuration = readDuration(record);
    const visit = asRecord(record.visit ?? record.placeVisit);

    if (visit) {
      const visitDuration = readDuration(visit);
      const start = recordDuration.start ?? visitDuration.start;
      const candidate = asRecord(visit.topCandidate);
      const location = asRecord(visit.location);
      const coordinate = parseGeoString(candidate?.placeLocation) ?? parseLegacyLocation(location);
      const semanticType = asString(candidate?.semanticType ?? location?.semanticType);
      const placeName = asString(location?.name ?? location?.address);
      const point = createPoint(coordinate, start, {
        id: `visit-${recordIndex}`,
        kind: "visit",
        label: placeName ?? (semanticType === "Aliased Location" ? "Saved place" : "Visited place"),
      });
      if (point) {
        points.push(point);
        visits += 1;
      }
      return;
    }

    const activity = asRecord(record.activity ?? record.activitySegment);
    if (activity) {
      const activityDuration = readDuration(activity);
      const start = recordDuration.start ?? activityDuration.start;
      const end = recordDuration.end ?? activityDuration.end;
      const candidate = asRecord(activity.topCandidate);
      const waypointPath = asRecord(activity.waypointPath);
      const activityType = prettifyActivity(
        asString(candidate?.type ?? activity.activityType ?? waypointPath?.travelMode),
      );
      const startCoordinate = parseGeoString(activity.start) ?? parseLegacyLocation(activity.startLocation);
      const endCoordinate = parseGeoString(activity.end) ?? parseLegacyLocation(activity.endLocation);
      const startPoint = createPoint(startCoordinate, start, {
        id: `activity-${recordIndex}-start`, kind: "activity", label: activityType, activityType,
      });
      const endPoint = createPoint(endCoordinate, end, {
        id: `activity-${recordIndex}-end`, kind: "activity", label: activityType, activityType,
      });
      if (startPoint) points.push(startPoint);
      if (endPoint) points.push(endPoint);

      const providedDistance = asNumber(activity.distanceMeters ?? activity.distance);
      activityDistance += providedDistance ?? (startCoordinate && endCoordinate ? distanceBetween(startCoordinate, endCoordinate) : 0);
      const existing = activities.get(activityType) ?? { label: activityType, count: 0, distanceMeters: 0 };
      existing.count += 1;
      existing.distanceMeters += providedDistance ?? 0;
      activities.set(activityType, existing);
      return;
    }

    if (Array.isArray(record.timelinePath)) {
      const start = recordDuration.start;
      record.timelinePath.forEach((rawPathPoint, pointIndex) => {
        const pathPoint = asRecord(rawPathPoint);
        const coordinate = parseGeoString(pathPoint?.point);
        const offset = asNumber(pathPoint?.durationMinutesOffsetFromStartTime) ?? 0;
        const timestamp = start ? new Date(Date.parse(start) + offset * 60_000).toISOString() : null;
        const point = createPoint(coordinate, timestamp, {
          id: `path-${recordIndex}-${pointIndex}`, kind: "path", label: "Timeline point",
        });
        if (point) points.push(point);
      });
    }
  });

  points.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const dedupedPoints = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || point.timestamp !== previous.timestamp || point.lat !== previous.lat || point.lng !== previous.lng;
  });
  if (dedupedPoints.length < 2) {
    throw new Error("We found timeline data, but not enough valid coordinates to build a replay.");
  }

  const fallbackDistance = dedupedPoints.slice(1).reduce((total, point, index) => {
    const distance = distanceBetween(dedupedPoints[index], point);
    return total + (distance < 250_000 ? distance : 0);
  }, 0);
  const days = new Set(dedupedPoints.map((point) => new Date(point.timestamp).toLocaleDateString("en-CA")));

  return {
    fileName,
    fileSizeBytes,
    sourceRecords: records.length,
    points: dedupedPoints,
    activities: [...activities.values()].sort((a, b) => b.count - a.count),
    summary: {
      visits,
      days: days.size,
      distanceMeters: activityDistance || fallbackDistance,
      startTime: dedupedPoints[0].timestamp,
      endTime: dedupedPoints.at(-1)!.timestamp,
    },
  };
}
