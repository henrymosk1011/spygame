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

## Playing on multiple phones (same network, no deploy)

1. Start the backend and frontend on one computer as above.
2. Find that computer's LAN IP address (e.g. `192.168.1.23`).
3. Set `VITE_WS_URL=ws://192.168.1.23:8000/ws` in `frontend/.env` and restart `npm run dev`.
4. On each phone, open `http://192.168.1.23:5173` (same Wi-Fi network required).

## Deploying publicly (one URL, no same-network requirement)

The backend can serve the built frontend directly, so the whole game lives behind a single
public URL with no extra hosting or configuration. This repo includes a `render.yaml`
blueprint for [Render](https://render.com):

1. On Render, choose **New > Blueprint** and point it at this repository. It reads
   `render.yaml` and creates one free web service that:
   - builds the frontend (`npm ci && npm run build` in `frontend/`)
   - installs the backend (`pip install -r backend/requirements.txt`)
   - runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`
2. Once it deploys, Render gives you a URL like `https://spygame.onrender.com`. Share that
   with friends — no room-code-network requirement, no separate frontend host, no environment
   variables to set. Each visitor's browser talks to the same-origin WebSocket automatically.

To build and serve it the same way locally (e.g. to sanity-check before deploying):

```bash
cd frontend && npm install && npm run build && cd ..
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000
# open http://localhost:8000 — the backend now serves the built frontend itself
```

Note: the free Render plan spins down after inactivity and takes ~30-60s to wake up on the
next visit. Also see "Notes on the current implementation" below — since state is in memory,
a Render restart or redeploy clears any in-progress rooms.

## Game flow

1. The host creates a room and shares the room code.
2. Everyone else joins with the code and a display name (minimum 3 players to start).
3. Before starting, the host can set the round length (1-30 minutes, default 8) and the number
   of spies (default 1, capped so spies always stay a strict minority of the table). Spies do
   not know who the other spies are.
4. The host starts the round. The server picks that many random Spies and one random secret word.
5. Every non-Spy player sees the secret word; each Spy sees nothing (not even a hint about what
   category it's from). The timer starts, and everyone can see how many spies are in play (but
   not who they are).
6. Any player can call a vote at any time. Before the actual vote happens, everyone else gets
   to Agree or Disagree — a majority must agree or the call is cancelled and play resumes on
   the clock. The caller can also cancel their own call at any time before it resolves.
7. Once a vote is approved, everyone votes on who they think is a Spy:
   - If they picked a Spy, that Spy gets one last chance to guess the secret word. A correct
     guess wins it for the Spies; a wrong guess reveals that Spy and, if any spies remain
     hidden, the round continues on the same clock. If that was the last Spy, the other
     players win.
   - If they picked a non-Spy, the Spies win outright.
   - If the vote is split with no single most-voted player, the vote fails and the round
     continues.
8. If time runs out with any Spy still uncaught, the Spies win.
9. The host can end the round early at any time with "Cancel round" — this reveals the Spies
   and the secret word without declaring a winner.
10. The host can start a new round with the same group from the results screen.

## Notes on the current implementation

- All room state lives in memory in the backend process. Restarting the backend clears every
  room.
- There is no database, authentication, or persistence — this is an MVP for a single game
  session.
