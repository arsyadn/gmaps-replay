"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  const currentIndex = Math.min(total - 1, Math.floor(position));

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-stone-500">
        <span>{currentTime}</span>
        <span>{currentIndex + 1} / {total} points</span>
      </div>
      <Slider
        aria-label="Replay timeline"
        min={0}
        max={Math.max(0, total - 1)}
        step={0.01}
        value={[position]}
        onValueChange={(values) => {
          const value = values[0];
          if (Number.isFinite(value)) onPositionChange(value);
        }}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            size="icon-lg"
            className="size-11 rounded-full bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700"
            onClick={onPlayToggle}
          >
            {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </Button>
          <Button
            aria-label="Restart replay"
            variant="outline"
            size="icon-lg"
            className="size-9 rounded-full text-stone-600"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
        <div className="flex items-center rounded-full bg-stone-100 p-1" aria-label="Playback speed">
          {SPEEDS.map((option) => (
            <Button
              key={option}
              variant="ghost"
              size="sm"
              className={`min-w-10 rounded-full px-2 text-xs ${speed === option ? "bg-white text-stone-950 shadow-sm hover:bg-white" : "text-stone-500 hover:bg-transparent hover:text-stone-900"}`}
              onClick={() => onSpeedChange(option)}
            >
              {option}×
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
