/**
 * Raw Google Takeout Semantic Location History Types
 */
export interface RawLocationE7 {
  latitudeE7?: number;
  longitudeE7?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  address?: string;
  name?: string;
  semanticType?: string;
}

export interface RawDuration {
  startTimestamp?: string;
  endTimestamp?: string;
  startTimestampMs?: string | number;
  endTimestampMs?: string | number;
}

export interface RawWaypointPath {
  waypoints?: Array<{
    latE7?: number;
    lngE7?: number;
    latitude?: number;
    longitude?: number;
  }>;
  distanceMeters?: number;
  travelMode?: string;
}

export interface RawPlaceVisit {
  location: RawLocationE7;
  duration: RawDuration;
  placeConfidence?: string;
  centerLatE7?: number;
  centerLngE7?: number;
  visitConfidence?: number;
  editConfirmationStatus?: string;
}

export interface RawActivitySegment {
  startLocation: RawLocationE7;
  endLocation: RawLocationE7;
  duration: RawDuration;
  distance?: number;
  activityType?: string;
  confidence?: string;
  activities?: Array<{
    activityType: string;
    probability: number;
  }>;
  waypointPath?: RawWaypointPath;
  simplifiedRawPath?: {
    points?: Array<{
      latE7: number;
      lngE7: number;
      timestampMs?: string;
    }>;
  };
}

export interface RawTimelineObject {
  placeVisit?: RawPlaceVisit;
  activitySegment?: RawActivitySegment;
}

export interface RawTakeoutPayload {
  timelineObjects?: RawTimelineObject[];
  rawRecords?: unknown[];
}

/**
 * Normalized Domain Types
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export type MovementType =
  | "WALKING"
  | "IN_PASSENGER_VEHICLE"
  | "CYCLING"
  | "MOTORCYCLING"
  | "IN_TRAIN"
  | "IN_SUBWAY"
  | "FLYING"
  | "STILL"
  | "UNKNOWN";

export interface NormalizedStop {
  id: string;
  type: "place";
  name: string;
  address?: string;
  placeId?: string;
  coordinate: LatLng;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationMinutes: number;
  category?: string;
  confidence?: string;
}

export interface NormalizedMovement {
  id: string;
  type: "movement";
  activityType: MovementType;
  distanceMeters: number;
  durationMinutes: number;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  startLocation: LatLng;
  endLocation: LatLng;
  startName?: string;
  endName?: string;
  waypoints: LatLng[];
}

export type TimelineEvent = NormalizedStop | NormalizedMovement;

export interface DayTimeline {
  dateKey: string;          // YYYY-MM-DD
  displayDate: string;      // e.g. "Monday, 21 September 2026"
  stopsCount: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  isTrip?: boolean;
  tripName?: string;
  events: TimelineEvent[];
}

export interface PlaceFrequency {
  name: string;
  address?: string;
  coordinate: LatLng;
  visitCount: number;
  totalMinutes: number;
  firstVisit: string;
  lastVisit: string;
  commonTimeWindow?: string;
}

export interface TimelineSummary {
  totalEvents: number;
  totalStops: number;
  totalDistanceKm: number;
  totalDurationHours: number;
  activeDaysCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  citiesVisited: string[];
  topPlaces: PlaceFrequency[];
  longestTripKm?: number;
  mostActiveMonth?: string;
}

export interface ParsedTimelineData {
  fileName: string;
  fileSizeBytes: number;
  parsedAt: string;
  summary: TimelineSummary;
  days: DayTimeline[];
}
