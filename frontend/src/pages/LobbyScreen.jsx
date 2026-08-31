import PlayerList from "../components/PlayerList.jsx";

const MIN_PLAYERS = 3; // must match MIN_PLAYERS in backend/app/game_logic.py

export default function LobbyScreen({ roomCode, players, selfId, isHost, onStartRound, errorMessage }) {
  const canStart = isHost && players.length >= MIN_PLAYERS;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-slate-900 px-4 py-12 text-center">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-400">Room code</p>
        <p className="text-5xl font-bold tracking-[0.3em] text-emerald-400">{roomCode}</p>
        <p className="mt-2 text-slate-400">Share this code so others can join.</p>
      </div>

      <div className="w-full max-w-sm">
        <h2 className="mb-2 text-left text-sm uppercase tracking-wide text-slate-400">
          Players ({players.length})
        </h2>
        <PlayerList players={players} selfId={selfId} />
      </div>

      {isHost ? (
        <div className="w-full max-w-sm space-y-2">
          <button
            type="button"
            disabled={!canStart}
            onClick={onStartRound}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start round
          </button>
          {!canStart && (
            <p className="text-sm text-slate-500">
              Need at least {MIN_PLAYERS} players to start.
            </p>
          )}
        </div>
      ) : (
        <p className="text-slate-400">Waiting for the host to start the round...</p>
      )}

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
    </div>
  );
}
