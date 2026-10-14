import locationHistory from "@/location-history.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json(locationHistory);
}
