import Timer from "../components/Timer.jsx";

export default function TimerScreen({ duration, startedAt, role, location, onCallVote }) {
  const isSpy = role === "spy";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-slate-900 px-4 text-center">
      <Timer duration={duration} startedAt={startedAt} />

      <div className="space-y-1">
        {isSpy ? (
          <p className="text-red-400">You are the Spy. Stay hidden.</p>
        ) : (
          <p className="text-slate-400">
            Location: <span className="font-semibold text-emerald-400">{location}</span>
          </p>
        )}
        <p className="text-sm text-slate-500">Ask each other questions out loud.</p>
      </div>

      <button
        type="button"
        onClick={onCallVote}
        className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500"
      >
        Call a vote
      </button>
    </div>
  );
}
