export default function PlayerList({ players, selfId }) {
  return (
    <ul className="w-full divide-y divide-slate-700 rounded-lg border border-slate-700 bg-slate-800/50">
      {players.map((player) => (
        <li
          key={player.id}
          className="flex items-center justify-between px-4 py-3 text-slate-100"
        >
          <span className="flex items-center gap-2">
            {player.name}
            {player.id === selfId && (
              <span className="text-xs text-slate-400">(you)</span>
            )}
          </span>
          <span className="flex items-center gap-2 text-xs">
            {player.is_host && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400">
                Host
              </span>
            )}
            {!player.connected && (
              <span className="rounded-full bg-slate-600/40 px-2 py-0.5 text-slate-400">
                Disconnected
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
