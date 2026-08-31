# Spy Game

A browser based multiplayer party game for a group in the same room. See `CLAUDE.md` for the
full game rules and project brief.

## Project layout

```
spygame/
  backend/    FastAPI app, all game state kept in memory
  frontend/   React + Vite + Tailwind CSS client
```

## Prerequisites

- Python 3.12
- Node.js 18+ and npm

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API serves a health check at `http://localhost:8000/health` and the game's WebSocket
endpoint at `ws://localhost:8000/ws`.

## Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in a browser tab per
player (or on separate phones on the same network — see below).

By default the frontend connects to `ws://<the page's hostname>:8000/ws`, so it works
out of the box when both servers run on the same machine. To point it at a different backend
(for example when testing from other devices), copy `frontend/.env.example` to `frontend/.env`
and set `VITE_WS_URL` explicitly:

```bash
cp frontend/.env.example frontend/.env
# then edit frontend/.env, e.g.:
# VITE_WS_URL=ws://192.168.1.23:8000/ws
```

## Playing on multiple phones

1. Start the backend and frontend on one computer as above.
2. Find that computer's LAN IP address (e.g. `192.168.1.23`).
3. Set `VITE_WS_URL=ws://192.168.1.23:8000/ws` in `frontend/.env` and restart `npm run dev`.
4. On each phone, open `http://192.168.1.23:5173` (same Wi-Fi network required).

## Game flow

1. The host creates a room and shares the room code.
2. Everyone else joins with the code and a display name (minimum 3 players to start).
3. The host starts the round. The server picks one random Spy and one random location.
4. Every non-Spy player sees the location; the Spy sees nothing. An 8 minute timer starts.
5. Anyone can call a vote at any time. If every connected player votes for the same person:
   - If they picked the Spy, the Spy gets one last chance to guess the location. A correct
     guess wins it for the Spy; otherwise the other players win.
   - If they picked the wrong person, the Spy wins outright.
   - If the vote is split with no single most-voted player, the vote fails and the round
     continues.
6. If time runs out with no resolved vote, the Spy wins.
7. The host can start a new round with the same group from the results screen.

## Notes on the current implementation

- All room state lives in memory in the backend process. Restarting the backend clears every
  room.
- There is no database, authentication, or persistence — this is an MVP for a single game
  session.
