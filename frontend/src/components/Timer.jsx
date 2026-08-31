import { useEffect, useState } from "react";

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function Timer({ duration, startedAt }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() / 1000 - startedAt;
      setRemaining(duration - elapsed);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [duration, startedAt]);

  const isLow = remaining <= 30;

  return (
    <div
      className={`text-6xl font-bold tabular-nums ${
        isLow ? "text-red-400" : "text-slate-100"
      }`}
    >
      {formatTime(remaining)}
    </div>
  );
}
