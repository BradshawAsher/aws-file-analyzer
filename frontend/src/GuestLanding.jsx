import React, { useState } from "react";
import { API_BASE_URL } from "./apiClient";

const samples = [
  {
    id: "image",
    label: "Image",
    filename: "mountain-trail.jpg",
    eyebrow: "Gemini Vision",
    result: "A high-altitude hiking trail crossing an alpine ridge, with evergreen forest and a glacial lake below.",
    tags: ["outdoors", "alpine", "travel"],
  },
  {
    id: "document",
    label: "Document",
    filename: "research-notes.pdf",
    eyebrow: "PDF summary",
    result: "The document compares managed cloud storage patterns and recommends private object storage with short-lived access links.",
    tags: ["cloud", "security", "summary"],
  },
  {
    id: "text",
    label: "Text",
    filename: "meeting-notes.txt",
    eyebrow: "Text analysis",
    result: "Key actions: finalize the deployment checklist, verify regression tests, and document operational dashboards.",
    tags: ["actions", "planning", "analysis"],
  },
];

const stack = [
  ["Cloudflare", "React SPA at the global edge"],
  ["Azure", ".NET 8 API, SQL, Key Vault, and monitoring"],
  ["AWS", "Private S3 object storage and presigned URLs"],
  ["Gemini", "Multimodal analysis with model fallback"],
];

export default function GuestLanding({ onLogin, onTryGuest, onViewGallery, isStartingGuest = false, guestError = "" }) {
  const [selectedSample, setSelectedSample] = useState(samples[0]);
  const swaggerUrl = `${API_BASE_URL}/swagger/index.html`;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_48%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_42%)]" />

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between" aria-label="Primary navigation">
          <a href="#overview" className="flex items-center gap-3 font-bold tracking-tight text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/25">AI</span>
            <span>AWS File Analyzer</span>
          </a>
          <div className="flex items-center gap-3">
            {onViewGallery && (
              <button
                type="button"
                onClick={onViewGallery}
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-white/10 hover:text-white sm:block"
              >
                🗺️ Gallery & Map
              </button>
            )}
            <a
              href={swaggerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white sm:block"
            >
              API Docs ↗
            </a>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-blue-50"
            >
              Log in
            </button>
          </div>
        </nav>

        <section id="overview" className="grid items-center gap-12 pb-20 pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:pt-28">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
              Live multi-cloud portfolio project
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Analyze files across four cloud platforms.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Upload images, PDFs, and text to private AWS S3 storage, process them with Google Gemini, and persist results through a .NET API backed by Azure SQL.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onTryGuest}
                disabled={isStartingGuest}
                className="rounded-xl bg-blue-500 px-6 py-3 font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
              >
                {isStartingGuest ? "Starting guest session..." : "Try the live analyzer as a guest"}
              </button>
              {onViewGallery && (
                <button
                  type="button"
                  onClick={onViewGallery}
                  className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-6 py-3 text-center font-bold text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/20"
                >
                  🗺️ Explore Gallery & Map
                </button>
              )}
              <a
                href={swaggerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/15 px-6 py-3 text-center font-bold text-white transition hover:border-white/30 hover:bg-white/10"
              >
                Explore Swagger API ↗
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">No account is required. Guest sessions can analyze one file at a time with tighter usage limits.</p>
            {guestError && <p className="mt-3 text-sm font-semibold text-rose-300" role="alert">{guestError}</p>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-blue-950/40 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Interactive sample</p>
                <h2 className="mt-1 text-xl font-bold">Analysis viewer</h2>
              </div>
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" aria-label="Live deployment online" />
            </div>

            <div className="mb-4 flex gap-2" role="tablist" aria-label="Sample file types">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedSample.id === sample.id}
                  onClick={() => setSelectedSample(sample)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    selectedSample.id === sample.id
                      ? "bg-blue-500 text-white"
                      : "bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-900/75 p-5 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold text-white">{selectedSample.filename}</p>
                  <p className="mt-1 text-xs text-slate-400">Stored privately in AWS S3</p>
                </div>
                <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-bold text-violet-200">{selectedSample.eyebrow}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-200">{selectedSample.result}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedSample.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-200">#{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 pt-10" aria-labelledby="stack-heading">
          <p id="stack-heading" className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Architecture at a glance</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stack.map(([name, description]) => (
              <article key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="font-bold text-white">{name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
