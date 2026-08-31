export default function VoteCallScreen({ callerName, isCaller, hasResponded, onAgree, onDisagree, onCancel }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 px-4 text-center">
      <p className="text-2xl font-bold text-slate-100">
        {isCaller ? "You called a vote" : `${callerName} wants to call a vote`}
      </p>
      <p className="text-slate-400">
        A majority needs to agree before the group actually votes on who the Spy is.
      </p>

      {isCaller ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          Never mind, cancel this
        </button>
      ) : hasResponded ? (
        <p className="text-sm text-slate-500">Waiting for the rest of the group...</p>
      ) : (
        <div className="flex w-full max-w-xs gap-3">
          <button
            type="button"
            onClick={onAgree}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500"
          >
            Agree
          </button>
          <button
            type="button"
            onClick={onDisagree}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            Disagree
          </button>
        </div>
      )}
    </div>
  );
}
