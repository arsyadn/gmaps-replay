import { CalendarDays, Footprints, MapPin, Route } from "lucide-react";
import { getMovementVisual } from "@/components/replay/replay-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ParsedLocationHistory } from "@/lib/types/replay";

interface ReplaySidebarProps {
  data: ParsedLocationHistory;
  onReset: () => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function SummaryCard({ icon: Icon, label, value }: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-2xl border-stone-200 bg-white p-4">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">{label}</p>
        <Icon className="size-4 text-orange-600" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-stone-950">{value}</p>
    </Card>
  );
}

export function ReplaySidebar({ data, onReset }: ReplaySidebarProps) {
  const movementCount = data.activities.reduce(
    (total, activity) => total + activity.count,
    0,
  );

  return (
    <aside className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={Route} label="Distance" value={`${(data.summary.distanceMeters / 1000).toFixed(0)} km`} />
        <SummaryCard icon={MapPin} label="Visits" value={data.summary.visits.toLocaleString()} />
        <SummaryCard icon={CalendarDays} label="Active days" value={data.summary.days.toLocaleString()} />
        <SummaryCard icon={Footprints} label="Track points" value={data.points.length.toLocaleString()} />
      </div>

      <Card className="rounded-2xl border-stone-200 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Date range</p>
        <div className="mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-stone-800">
          <span>{formatDate(data.summary.startTime)}</span>
          <span className="h-px flex-1 bg-stone-200" />
          <span>{formatDate(data.summary.endTime)}</span>
        </div>
      </Card>

      <Card className="flex-1 rounded-2xl border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">Movement mix</p>
          <span className="text-right text-xs text-stone-400">
            {data.activities.length} modes · <strong className="font-bold text-stone-600">{movementCount} movements</strong>
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {data.activities.map((activity) => {
            const percentage = movementCount > 0
              ? (activity.count / movementCount) * 100
              : 0;
            const activityVisual = getMovementVisual(activity.label, "activity");
            return (
              <div key={activity.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-stone-700">
                    <span aria-hidden="true">{activityVisual.emoji}</span>
                    {activity.label}
                  </span>
                  <span className="flex items-baseline gap-1 tabular-nums">
                    <span className="font-bold text-stone-700">{activity.count}×</span>
                    <span className="text-stone-400">· {percentage.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${activityVisual.markerClassName}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Button variant="outline" onClick={onReset} className="h-auto rounded-2xl bg-white p-4 text-sm font-semibold text-stone-600 hover:border-stone-300 hover:text-stone-950">
        Load a different history
      </Button>
    </aside>
  );
}
