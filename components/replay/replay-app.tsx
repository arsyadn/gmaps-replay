"use client";

import { useState } from "react";
import { AppHeader } from "@/components/replay/app-header";
import { DateRangeModal } from "@/components/replay/date-range-modal";
import { Landing } from "@/components/replay/landing";
import { ReplayWorkspace } from "@/components/replay/replay-workspace";
import {
  inspectGoogleTimelineJson,
  parseGoogleTimelineJson,
  type TimelineDateRange,
} from "@/lib/parser/google-timeline";
import type { ParsedLocationHistory } from "@/lib/types/replay";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface TimelineSource {
  text: string;
  name: string;
  size: number;
  availableStartDate: string;
  availableEndDate: string;
}

export function ReplayApp() {
  const [data, setData] = useState<ParsedLocationHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<TimelineSource | null>(null);
  const [activeSource, setActiveSource] = useState<TimelineSource | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimelineDateRange | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const parseText = (text: string, name: string, size: number) => {
    setData(parseGoogleTimelineJson(text, name, size));
  };

  const loadFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please choose a .json file exported from Google Timeline.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("That file is larger than 50 MB. Split the export by year and try again.");
      return;
    }
    setIsLoading(true);
    try {
      const text = await file.text();
      const inspection = inspectGoogleTimelineJson(text);
      setPendingUpload({
        text,
        name: file.name,
        size: file.size,
        availableStartDate: inspection.startDate,
        availableEndDate: inspection.endDate,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We could not read that file.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectedRange = async (startDate: string, endDate: string) => {
    if (!pendingUpload) return;
    setDateRangeError(null);
    setIsLoading(true);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    try {
      setData(parseGoogleTimelineJson(
        pendingUpload.text,
        pendingUpload.name,
        pendingUpload.size,
        { startDate, endDate },
      ));
      setActiveSource(pendingUpload);
      setSelectedRange({ startDate, endDate });
      setPendingUpload(null);
    } catch (caughtError) {
      setDateRangeError(
        caughtError instanceof Error ? caughtError.message : "We could not load that date range.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadBuiltIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/built-in-history");
      if (!response.ok) throw new Error("The built-in history is unavailable.");
      const text = await response.text();
      const inspection = inspectGoogleTimelineJson(text);
      setActiveSource({
        text,
        name: "location-history.json",
        size: new Blob([text]).size,
        availableStartDate: inspection.startDate,
        availableEndDate: inspection.endDate,
      });
      setSelectedRange(null);
      parseText(text, "location-history.json", new Blob([text]).size);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The built-in history could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setPendingUpload(null);
    setActiveSource(null);
    setSelectedRange(null);
    setError(null);
    setDateRangeError(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f1] text-stone-950">
      <AppHeader hasData={Boolean(data)} onReset={reset} />
      {data ? (
        <ReplayWorkspace
          key={`${data.summary.startTime}-${data.summary.endTime}`}
          data={data}
          onReset={reset}
          onChangeDateRange={() => {
            if (activeSource) {
              setDateRangeError(null);
              setPendingUpload(activeSource);
            }
          }}
        />
      ) : (
        <Landing
          onFile={loadFile}
          onBuiltIn={loadBuiltIn}
          isLoading={isLoading}
          error={error}
        />
      )}
      {pendingUpload ? (
        <DateRangeModal
          fileName={pendingUpload.name}
          availableStartDate={pendingUpload.availableStartDate}
          availableEndDate={pendingUpload.availableEndDate}
          initialStartDate={selectedRange?.startDate}
          initialEndDate={selectedRange?.endDate}
          isLoading={isLoading}
          error={dateRangeError}
          onCancel={() => {
            setPendingUpload(null);
            setDateRangeError(null);
          }}
          onConfirm={loadSelectedRange}
        />
      ) : null}
    </div>
  );
}
