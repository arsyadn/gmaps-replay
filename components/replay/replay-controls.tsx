"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

const SPEEDS = [0.5, 1, 2, 4] as const;

interface ReplayControlsProps {
  position: number;
  total: number;
  isPlaying: boolean;
  speed: number;
  currentTime: string;
  onPositionChange: (value: number) => void;
  onPlayToggle: () => void;
  onSpeedChange: (value: number) => void;
  onReset: () => void;
}

export function ReplayControls({
  position,
  total,
  isPlaying,
  speed,
  currentTime,
  onPositionChange,
  onPlayToggle,
  onSpeedChange,
  onReset,
}: ReplayControlsProps) {
  const progress = total > 1 ? (position / (total - 1)) * 100 : 0;
  const currentIndex = Math.min(total - 1, Math.floor(position));

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-stone-500">
        <span>{currentTime}</span>
        <span>{currentIndex + 1} / {total} points</span>
      </div>
      <input
        aria-label="Replay timeline"
        className="replay-range w-full"
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        step="0.01"
        value={position}
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
        onChange={(event) => onPositionChange(Number(event.target.value))}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            className="grid size-11 place-items-center rounded-full bg-orange-600 text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700"
            onClick={onPlayToggle}
          >
            {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>
          <button
            type="button"
            aria-label="Restart replay"
            className="grid size-9 place-items-center rounded-full border border-stone-200 text-stone-600 transition hover:bg-stone-100"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <div className="flex items-center rounded-full bg-stone-100 p-1" aria-label="Playback speed">
          {SPEEDS.map((option) => (
            <button
              key={option}
              type="button"
              className={`min-w-10 rounded-full px-2 py-1.5 text-xs font-semibold transition ${speed === option ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
              onClick={() => onSpeedChange(option)}
            >
              {option}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
