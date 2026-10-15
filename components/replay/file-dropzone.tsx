"use client";

import { useRef, useState } from "react";
import { ArrowRight, FileJson, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  onBuiltIn: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function FileDropzone({ onFile, onBuiltIn, isLoading = false, error }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const acceptFile = (file?: File) => {
    if (file) onFile(file);
  };

  return (
    <Card className="rounded-[2rem] border-stone-200 bg-white p-3 shadow-[0_28px_80px_-42px_rgba(35,31,28,0.45)] sm:p-4">
      <div
        className={cn(
          "flex min-h-72 flex-col items-center justify-center rounded-[1.45rem] border border-dashed px-6 py-10 text-center transition-all",
          isDragging ? "border-orange-500 bg-orange-50" : "border-stone-300 bg-[#fbfaf7]",
        )}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          acceptFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            acceptFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-stone-950 text-white shadow-lg shadow-stone-950/15">
          {isLoading ? <LoaderCircle className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}
        </div>
        <p className="text-lg font-semibold tracking-tight text-stone-950">Drop your Location History here</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-stone-500">Timeline JSON from your phone · processed privately in your browser</p>
        <Button
          className="mt-6 h-11 rounded-full bg-orange-600 px-5 text-white hover:bg-orange-700"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
        >
          <FileJson /> Choose JSON file
        </Button>
        {error ? <p role="alert" className="mt-4 max-w-sm text-sm font-medium text-red-600">{error}</p> : null}
      </div>
      <Button
        variant="ghost"
        className="group mt-2 h-auto w-full justify-between rounded-2xl px-4 py-3 text-left hover:bg-stone-50"
        onClick={onBuiltIn}
        disabled={isLoading}
      >
        <span>
          <span className="block text-sm font-semibold text-stone-900">Want to explore first?</span>
          <span className="block text-xs text-stone-500">Replay the built-in multi-city journey</span>
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-stone-200 text-stone-600 transition group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-orange-700">
          <ArrowRight className="size-4" />
        </span>
      </Button>
    </Card>
  );
}
