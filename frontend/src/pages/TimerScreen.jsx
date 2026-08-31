import Timer from "../components/Timer.jsx";

export default function TimerScreen({
  duration,
  startedAt,
  role,
  location,
  spyCount,
  lastSpyReveal,
  onDismissSpyReveal,
  isHost,
  onCallVote,
  onCancelRound,
}) {
  const isSpy = role === "spy";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-900 px-4 text-center">
      {lastSpyReveal && (
        <div className="flex w-full max-w-sm items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-300">
          <p>
            {lastSpyReveal.name} was caught and was a Spy! {lastSpyReveal.remaining} more{" "}
            {lastSpyReveal.remaining === 1 ? "spy is" : "spies are"} still hidden. Keep asking
            questions.
          </p>
          <button type="button" onClick={onDismissSpyReveal} className="text-amber-300/70 hover:text-amber-200">
            ×
          </button>
        </div>
      )}

      <Timer duration={duration} startedAt={startedAt} />

      <div className="space-y-1">
        {isSpy ? (
          <p className="text-red-400">You are the Spy. Stay hidden.</p>
        ) : (
          <p className="text-slate-400">
            Location: <span className="font-semibold text-emerald-400">{location}</span>
          </p>
        )}
        {spyCount > 1 && <p className="text-sm text-slate-500">Spies this round: {spyCount}</p>}
        <p className="text-sm text-slate-500">Ask each other questions out loud.</p>
      </div>

      <button
        type="button"
        onClick={onCallVote}
        className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500"
      >
        Call a vote
      </button>

      {isHost && (
        <button
          type="button"
          onClick={onCancelRound}
          className="text-sm text-slate-500 underline transition hover:text-slate-300"
        >
          Cancel round
        </button>
      )}
    </div>
  );
}
