"use client";

import { useState } from "react";
import { AppHeader } from "@/components/replay/app-header";
import { Landing } from "@/components/replay/landing";
import { ReplayWorkspace } from "@/components/replay/replay-workspace";
import { parseGoogleTimelineJson } from "@/lib/parser/google-timeline";
import type { ParsedLocationHistory } from "@/lib/types/replay";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function ReplayApp() {
  const [data, setData] = useState<ParsedLocationHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      parseText(await file.text(), file.name, file.size);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "We could not read that file.");
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
      parseText(text, "location-history.json", new Blob([text]).size);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The built-in history could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f1] text-stone-950">
      <AppHeader hasData={Boolean(data)} onReset={reset} />
      {data ? (
        <ReplayWorkspace data={data} onReset={reset} />
      ) : (
        <Landing
          onFile={loadFile}
          onBuiltIn={loadBuiltIn}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
}
