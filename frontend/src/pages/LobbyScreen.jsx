import { useEffect, useState } from "react";
import PlayerList from "../components/PlayerList.jsx";

const MIN_PLAYERS = 3; // must match MIN_PLAYERS in backend/app/game_logic.py
const MIN_ROUND_MINUTES = 1; // must match MIN_ROUND_MINUTES in backend/app/main.py
const MAX_ROUND_MINUTES = 30; // must match MAX_ROUND_MINUTES in backend/app/main.py

function maxSpiesFor(playerCount) {
  // Must match max_spies_for() in backend/app/game_logic.py
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

export default function LobbyScreen({ roomCode, players, selfId, isHost, onStartRound, errorMessage }) {
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [spyCount, setSpyCount] = useState(1);

  const canStart = isHost && players.length >= MIN_PLAYERS;
  const maxSpies = maxSpiesFor(players.length);

  useEffect(() => {
    setSpyCount((current) => Math.min(current, maxSpies));
  }, [maxSpies]);

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
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left">
            <label className="block">
              <span className="text-sm text-slate-400">Round length (minutes)</span>
              <input
                type="number"
                min={MIN_ROUND_MINUTES}
                max={MAX_ROUND_MINUTES}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(
                    Math.max(
                      MIN_ROUND_MINUTES,
                      Math.min(MAX_ROUND_MINUTES, Number(e.target.value) || MIN_ROUND_MINUTES)
                    )
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-400">
                Number of spies {maxSpies > 1 && `(max ${maxSpies})`}
              </span>
              <input
                type="number"
                min={1}
                max={maxSpies}
                value={spyCount}
                onChange={(e) =>
                  setSpyCount(Math.max(1, Math.min(maxSpies, Number(e.target.value) || 1)))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={!canStart}
            onClick={() => onStartRound(durationMinutes, spyCount)}
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
