import { useState } from "react";
import { LOCATIONS } from "../locations.js";

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function RoundEndView({ roundEnd, isHost, onNewRound }) {
  const spyNames = roundEnd.spy_names ?? [];
  const wasSpy = spyNames.length > 1 ? "were the Spies" : "was the Spy";
  const heading =
    roundEnd.winner === "players"
      ? "Players win!"
      : roundEnd.winner === "spy"
        ? "Spy wins!"
        : "Round cancelled";
  const headingColor =
    roundEnd.winner === "players"
      ? "text-emerald-400"
      : roundEnd.winner === "spy"
        ? "text-red-400"
        : "text-slate-300";

  return (
    <div className="space-y-6">
      <p className={`text-3xl font-bold ${headingColor}`}>{heading}</p>
      <p className="text-slate-300">
        {joinNames(spyNames)} {wasSpy}. The location was{" "}
        <span className="font-semibold text-emerald-400">{roundEnd.location}</span>.
      </p>
      {isHost ? (
        <button
          type="button"
          onClick={onNewRound}
          className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
        >
          Start a new round
        </button>
      ) : (
        <p className="text-sm text-slate-500">Waiting for the host to start a new round...</p>
      )}
    </div>
  );
}

function SpyGuessView({ caughtInfo, isBeingGuessed, onSpyGuess }) {
  const [guess, setGuess] = useState("");

  if (!isBeingGuessed) {
    return (
      <p className="text-slate-300">
        {caughtInfo.accused_name} was accused of being the Spy and gets one chance to guess the
        location...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-red-400">You were caught! Guess the location for one last chance to win.</p>
      <select
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-emerald-500"
      >
        <option value="" disabled>
          Choose a location
        </option>
        {LOCATIONS.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!guess}
        onClick={() => onSpyGuess(guess)}
        className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit guess
      </button>
    </div>
  );
}

function ActiveVoteView({ candidates, votedIds, selfId, isHost, onCastVote, onCancelRound }) {
  const hasVoted = votedIds.includes(selfId);

  return (
    <div className="w-full max-w-sm space-y-4">
      <p className="text-slate-400">Who do you think is the Spy?</p>
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => onCastVote(candidate.id)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-100 transition hover:bg-slate-700"
            >
              {candidate.name}
              {candidate.id === selfId && <span className="text-slate-400"> (you)</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-500">
        {hasVoted
          ? "Vote recorded. You can change it any time."
          : "Tap a name to cast your vote."}{" "}
        {votedIds.length}/{candidates.length} have voted.
      </p>
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

export default function VotingScreen({
  candidates,
  votedIds,
  selfId,
  isHost,
  caughtInfo,
  roundEnd,
  onCastVote,
  onSpyGuess,
  onNewRound,
  onCancelRound,
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 px-4 text-center">
      {roundEnd ? (
        <RoundEndView roundEnd={roundEnd} isHost={isHost} onNewRound={onNewRound} />
      ) : caughtInfo ? (
        <SpyGuessView
          caughtInfo={caughtInfo}
          isBeingGuessed={caughtInfo.accused_id === selfId}
          onSpyGuess={onSpyGuess}
        />
      ) : (
        <ActiveVoteView
          candidates={candidates}
          votedIds={votedIds}
          selfId={selfId}
          isHost={isHost}
          onCastVote={onCastVote}
          onCancelRound={onCancelRound}
        />
      )}
    </div>
  );
}
