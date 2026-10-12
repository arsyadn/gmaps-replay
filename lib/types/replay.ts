export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ReplayPoint extends GeoPoint {
  id: string;
  timestamp: string;
  kind: "visit" | "activity" | "path";
  label: string;
  activityType?: string;
}

export interface ActivityBreakdown {
  label: string;
  count: number;
  distanceMeters: number;
}

export interface ParsedLocationHistory {
  fileName: string;
  fileSizeBytes: number;
  sourceRecords: number;
  points: ReplayPoint[];
  activities: ActivityBreakdown[];
  summary: {
    visits: number;
    days: number;
    distanceMeters: number;
    startTime: string;
    endTime: string;
  };
}
