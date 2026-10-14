import { ChevronLeft, LockKeyhole, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  hasData: boolean;
  onReset: () => void;
}

export function AppHeader({ hasData, onReset }: AppHeaderProps) {
  return (
    <header className="flex h-18 items-center justify-between border-b border-stone-200/80 bg-[#f7f6f1]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
      <Button variant="ghost" className="h-auto gap-2.5 p-0 hover:bg-transparent" onClick={onReset}>
        <span className="grid size-9 place-items-center rounded-xl bg-stone-950 text-white">
          <Route className="size-4" />
        </span>
        <span className="text-sm font-extrabold tracking-[0.16em] text-stone-950">TRACEBACK</span>
      </Button>
      <div className="flex items-center gap-3">
        {/* <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:flex">
          <LockKeyhole className="size-3" /> Local only
        </Badge> */}
        {hasData ? (
          <Button variant="outline" className="h-9 rounded-full bg-white px-4" onClick={onReset}>
            <ChevronLeft className="size-3.5" /> New file
          </Button>
        ) : null}
      </div>
    </header>
  );
}
