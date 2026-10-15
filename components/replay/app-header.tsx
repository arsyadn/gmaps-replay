import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import tracebackIcon from "@/app/traceback-icon.svg";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  hasData: boolean;
  onReset: () => void;
}

export function AppHeader({ hasData, onReset }: AppHeaderProps) {
  return (
    <header className="flex h-18 items-center justify-between border-b border-stone-200/80 bg-[#f7f6f1]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
      <Button variant="ghost" className="h-auto gap-2.5 p-0 hover:bg-transparent" onClick={onReset}>
        <Image
          src={tracebackIcon}
          alt=""
          width={100}
          height={100}
          unoptimized
          className="size-12 rounded-xl"
        />
        <span className="text-sm font-extrabold tracking-[0.16em] text-stone-950">TRACEBACK</span>
      </Button>
      <div className="flex items-center gap-3">
        {hasData ? (
          <Button variant="outline" className="h-9 rounded-full bg-white px-4" onClick={onReset}>
            <ChevronLeft className="size-3.5" /> New file
          </Button>
        ) : null}
      </div>
    </header>
  );
}
