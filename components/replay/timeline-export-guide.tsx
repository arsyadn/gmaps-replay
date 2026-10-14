import { ExternalLink, FileJson2, LockKeyhole, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";

const platformGuides = [
  {
    platform: "Android",
    source: "Phone settings",
    steps: [
      "Open Settings, then Location.",
      "Choose Location services, then Timeline.",
      "Tap Export Timeline data and Continue.",
      "Choose a folder, then tap Save.",
    ],
    helpUrl: "https://support.google.com/maps/answer/14169818?co=GENIE.Platform%3DAndroid&hl=en-419",
  },
  {
    platform: "iPhone & iPad",
    source: "Google Maps app",
    steps: [
      "Open Google Maps and tap your profile picture.",
      "Choose Settings, then Personal content.",
      "Tap Export Timeline data.",
      "Choose Save to Files, select a folder, and tap Save.",
    ],
    helpUrl: "https://support.google.com/maps/answer/6258979?co=GENIE.Platform%3DiOS&hl=en-GB",
  },
] as const;

export function TimelineExportGuide() {
  return (
    <section id="get-your-json" aria-labelledby="export-guide-title" className="mt-14 scroll-mt-8">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Get your JSON</p>
          <h2 id="export-guide-title" className="text-3xl font-semibold tracking-[-0.035em] text-stone-950">
            Export Timeline from your phone
          </h2>
        </div>
        {/* <p className="max-w-md text-sm leading-6 text-stone-500">
          Google Timeline is now stored on your device, so the current export flow starts from the phone that holds your history.
        </p> */}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {platformGuides.map((guide) => (
          <Card key={guide.platform} className="rounded-3xl border-stone-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                  <Smartphone className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-stone-950">{guide.platform}</h3>
                  <p className="text-xs text-stone-500">Start in {guide.source}</p>
                </div>
              </div>
              <a
                href={guide.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 transition-colors hover:text-orange-700"
              >
                Google guide <ExternalLink className="size-3" />
              </a>
            </div>

            <ol className="mt-6 space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-stone-600">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      {/* <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 font-medium">
          <LockKeyhole className="size-4 shrink-0" /> Your exported file is processed only in this browser.
        </span>
        <span className="flex items-center gap-2 text-xs text-emerald-700">
          <FileJson2 className="size-4" /> Upload the saved .json file above
        </span>
      </div> */}
    </section>
  );
}
