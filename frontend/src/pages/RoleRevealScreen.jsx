import { useState } from "react";

export default function RoleRevealScreen({ role, location, onReady }) {
  const [revealed, setRevealed] = useState(false);
  const isSpy = role === "spy";

  if (!revealed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 px-4 text-center">
        <p className="text-slate-400">Make sure no one else can see your screen.</p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-lg bg-emerald-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-emerald-500"
        >
          Reveal my role
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 px-4 text-center">
      {isSpy ? (
        <div className="space-y-4">
          <p className="text-2xl font-bold text-red-400">You are the Spy</p>
          <p className="max-w-xs text-slate-400">
            You don't know the location. Listen closely and try to blend in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-wide text-slate-400">The location is</p>
          <p className="text-4xl font-bold text-emerald-400">{location}</p>
          <p className="max-w-xs text-slate-400">
            One player at the table is the Spy. Ask questions to find them without giving this away.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onReady}
        className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
      >
        Got it, start the timer
      </button>
    </div>
  );
}
