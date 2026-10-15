"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, FileJson, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseDateValue, shiftDateValueByYear } from "@/lib/date-range";

interface DateRangeModalProps {
  fileName: string;
  availableStartDate: string;
  availableEndDate: string;
  initialStartDate?: string;
  initialEndDate?: string;
  isLoading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
}

function earlierDate(first: string, second: string) {
  return first < second ? first : second;
}

function laterDate(first: string, second: string) {
  return first > second ? first : second;
}

function getYearDateRange(year: number, availableStartDate: string, availableEndDate: string) {
  return {
    startDate: laterDate(`${year}-01-01`, availableStartDate),
    endDate: earlierDate(`${year}-12-31`, availableEndDate),
  };
}

function formatDisplayDate(value: string) {
  const date = parseDateValue(value);
  return date
    ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date)
    : value;
}

function countSelectedDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.floor((end - start) / 86_400_000) + 1
    : 0;
}

export function DateRangeModal({
  fileName,
  availableStartDate,
  availableEndDate,
  initialStartDate,
  initialEndDate,
  isLoading,
  error,
  onCancel,
  onConfirm,
}: DateRangeModalProps) {
  const latestStartDate = shiftDateValueByYear(availableEndDate, -1) ?? availableStartDate;
  const defaultStartDate = availableStartDate > latestStartDate ? availableStartDate : latestStartDate;
  const requestedStartDate = initialStartDate && initialStartDate >= availableStartDate && initialStartDate <= availableEndDate
    ? initialStartDate
    : defaultStartDate;
  const initialMaximumEndDate = earlierDate(
    availableEndDate,
    shiftDateValueByYear(requestedStartDate, 1) ?? availableEndDate,
  );
  const requestedEndDate = initialEndDate && initialEndDate >= requestedStartDate && initialEndDate <= initialMaximumEndDate
    ? initialEndDate
    : initialMaximumEndDate;
  const [startDate, setStartDate] = useState(requestedStartDate);
  const [endDate, setEndDate] = useState(requestedEndDate);
  const availableYears = useMemo(() => {
    const firstYear = Number(availableStartDate.slice(0, 4));
    const lastYear = Number(availableEndDate.slice(0, 4));
    return Array.from(
      { length: Math.max(0, lastYear - firstYear + 1) },
      (_, index) => lastYear - index,
    );
  }, [availableEndDate, availableStartDate]);
  const maximumEndDate = useMemo(
    () => earlierDate(availableEndDate, shiftDateValueByYear(startDate, 1) ?? availableEndDate),
    [availableEndDate, startDate],
  );
  const selectedPresetYear = availableYears.find((year) => {
    const yearRange = getYearDateRange(year, availableStartDate, availableEndDate);
    return startDate === yearRange.startDate && endDate === yearRange.endDate;
  });
  const validationError = !startDate || !endDate
    ? "Choose both dates to continue."
    : endDate < startDate
      ? "End date must be on or after start date."
      : endDate > maximumEndDate
        ? "Choose a date range of one year or less."
        : null;
  const selectedDays = countSelectedDays(startDate, endDate);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validationError && !isLoading) onConfirm(startDate, endDate);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isLoading) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-950/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#fbfaf7] shadow-[0_32px_90px_-24px_rgba(28,25,23,0.6)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onEscapeKeyDown={(event) => { if (isLoading) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (isLoading) event.preventDefault(); }}
        >
          <form onSubmit={submit}>
            <div className="border-b border-stone-200 bg-white px-6 pb-5 pt-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700">
                  <CalendarDays className="size-5" />
                </div>
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" size="icon" className="rounded-full text-stone-500" disabled={isLoading} aria-label="Cancel date selection">
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
              <Dialog.Title className="mt-5 text-2xl font-semibold tracking-tight text-stone-950">
                Choose your replay dates
              </Dialog.Title>
              {/* <Dialog.Description className="mt-2 text-sm leading-6 text-stone-500">
                Select up to one year of history. A smaller range keeps your map smooth and responsive.
              </Dialog.Description> */}
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                <FileJson className="size-4 shrink-0 text-stone-700" />
                <span className="min-w-0 flex-1 truncate font-medium text-stone-700">{fileName}</span>
                <span className="shrink-0">{formatDisplayDate(availableStartDate)} – {formatDisplayDate(availableEndDate)}</span>
              </div>
            </div>

            <div className="px-6 py-6 sm:px-7">
              <div className="mb-5 grid gap-2">
                <label
                  id="quick-year-label"
                  className="text-sm font-semibold text-stone-800"
                >
                  Quick select a year
                </label>
                <Select
                  value={selectedPresetYear?.toString() ?? ""}
                  disabled={isLoading}
                  onValueChange={(value) => {
                    const year = Number(value);
                    if (!Number.isInteger(year)) return;
                    const yearRange = getYearDateRange(
                      year,
                      availableStartDate,
                      availableEndDate,
                    );
                    setStartDate(yearRange.startDate);
                    setEndDate(yearRange.endDate);
                  }}
                >
                  <SelectTrigger
                    aria-labelledby="quick-year-label"
                    className="h-12! w-full rounded-xl border-stone-300 bg-white px-3 font-medium text-stone-900 focus-visible:border-orange-500 focus-visible:ring-orange-100"
                  >
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="rounded-xl">
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-stone-800">
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    min={availableStartDate}
                    max={availableEndDate}
                    disabled={isLoading}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      setStartDate(nextStart);
                      const nextMaximum = earlierDate(
                        availableEndDate,
                        shiftDateValueByYear(nextStart, 1) ?? availableEndDate,
                      );
                      if (endDate < nextStart) setEndDate(nextStart);
                      else if (endDate > nextMaximum) setEndDate(nextMaximum);
                    }}
                    className="h-12 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-stone-800">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || availableStartDate}
                    max={maximumEndDate}
                    disabled={isLoading}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-12 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-orange-600" />
                <p>
                  {selectedDays > 0 ? `${selectedDays.toLocaleString()} days selected. ` : ""}
                  {/* Your file stays on this device and is processed in your browser. */}
                </p>
              </div>

              {validationError || error ? (
                <p role="alert" className="mt-4 text-sm font-medium text-red-600">
                  {validationError ?? error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" className="h-11 rounded-full px-5 text-stone-600" disabled={isLoading}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                className="h-11 rounded-full bg-orange-600 px-6 text-white hover:bg-orange-700"
                disabled={Boolean(validationError) || isLoading}
              >
                {isLoading ? <LoaderCircle className="animate-spin" /> : <CalendarDays />}
                {isLoading ? "Preparing replay…" : "Load this date range"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
