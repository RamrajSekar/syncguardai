import { SyncGuardWorkspace } from "@/components/SyncGuardWorkspace";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            SyncGuard AI
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Audit integration files before they reach your workflow backend.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              Upload CSV, JSON, TXT, and XML samples locally, scrub sensitive
              fields in the browser, then send only sanitized payloads for
              stateless mapping analysis.
            </p>
          </div>
        </header>

        <SyncGuardWorkspace />
      </section>
    </main>
  );
}
