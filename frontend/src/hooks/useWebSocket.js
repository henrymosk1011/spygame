import { useCallback, useEffect, useRef, useState } from "react";

// In dev, the backend runs as a separate process on port 8000. In a production build served by
// the backend itself (see backend/app/main.py), the WebSocket lives on the same origin as the page.
const DEFAULT_WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8000/ws`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

export default function useWebSocket(onMessage) {
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => setStatus("open");
    socket.onclose = () => setStatus("closed");
    socket.onerror = () => setStatus("error");
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("Received malformed message from server", err);
        return;
      }
      onMessageRef.current?.(data);
    };

    return () => socket.close();
  }, []);

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return { status, sendMessage };
}
