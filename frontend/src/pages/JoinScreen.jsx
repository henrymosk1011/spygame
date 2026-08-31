import { useState } from "react";

export default function JoinScreen({ onCreateRoom, onJoinRoom, errorMessage, connectionStatus }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const canSubmit = name.trim().length > 0 && connectionStatus === "open";

  // Blur whatever's focused before navigating away, so the on-screen keyboard starts closing
  // immediately instead of while (or after) the next screen has already mounted.
  const blurActiveElement = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold text-slate-100">Spy Game</h1>
        <p className="mt-2 text-slate-400">Find the spy before time runs out.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
        />

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            blurActiveElement();
            onCreateRoom(name.trim());
          }}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create a room
        </button>

        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs uppercase tracking-wide">or</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Room code"
          maxLength={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-center text-lg tracking-[0.3em] text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
        />

        <button
          type="button"
          disabled={!canSubmit || roomCode.trim().length === 0}
          onClick={() => {
            blurActiveElement();
            onJoinRoom(name.trim(), roomCode.trim());
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join a room
        </button>

        {connectionStatus !== "open" && (
          <p className="text-sm text-amber-400">Connecting to server...</p>
        )}
        {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
      </div>
    </div>
  );
}
