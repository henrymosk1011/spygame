import { useCallback, useEffect, useRef, useState } from "react";

// In dev, the backend runs as a separate process on port 8000. In a production build served by
// the backend itself (see backend/app/main.py), the WebSocket lives on the same origin as the page.
const DEFAULT_WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8000/ws`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

// Hosting proxies (e.g. Render's) silently close WebSocket connections that sit idle for too
// long -- which happens easily just sitting on the join/lobby screen. A small periodic ping
// keeps the connection classified as active so players don't get stuck needing to refresh.
const PING_INTERVAL_MS = 20000;

export default function useWebSocket(onMessage) {
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    let pingInterval = null;

    socket.onopen = () => {
      setStatus("open");
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };
    socket.onclose = () => {
      setStatus("closed");
      clearInterval(pingInterval);
    };
    socket.onerror = () => setStatus("error");
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("Received malformed message from server", err);
        return;
      }
      if (data.type === "pong") return;
      onMessageRef.current?.(data);
    };

    return () => {
      clearInterval(pingInterval);
      socket.close();
    };
  }, []);

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return { status, sendMessage };
}
