# Spy Game

## What this is
A browser based multiplayer party game for a group in the same room. Each player joins from their own phone using a room code. Everyone gets the same secret location except one player, the Spy, who gets nothing. Players take turns asking each other questions about the location to expose the Spy without giving the location away themselves. The Spy wins by staying hidden until time runs out or by correctly guessing the location.

## Tech stack
- Backend: FastAPI (Python 3.12), native WebSocket support
- Frontend: React + Vite + Tailwind CSS
- State: in memory game rooms for the MVP (no database yet)
- Deployment target: Render, same pattern as PawParazzi

## Core game loop
1. Host creates a room and gets a short room code
2. Other players join by entering the code and a display name
3. Host starts the round once everyone has joined
4. Server picks one random Spy and one random location from the location list
5. Every non Spy player's screen shows the location. The Spy's screen shows nothing
6. An eight minute timer starts
7. Players ask each other questions out loud (this part happens in person, the app just tracks state and time)
8. Any player can call a vote at any time
9. If the group votes on the Spy correctly, the non Spy players win
10. If the vote is wrong, or time runs out, the Spy wins unless they're given one chance to guess the location out loud, in which case a correct guess also wins it for the Spy
11. Host can start a new round with the same group

## Sample location list (expand later)
Airplane, Bank, Beach, Casino, Circus Tent, Corporate Party, Day Spa, Embassy, Hospital, Hotel, Military Base, Movie Studio, Ocean Liner, Passenger Train, Pirate Ship, Police Station, Restaurant, School, Space Station, Submarine, Supermarket, Theater

## File structure
spygame/
  CLAUDE.md
  backend/
    app/
      main.py
      rooms.py
      game_logic.py
      websocket_manager.py
    requirements.txt
  frontend/
    src/
      components/
      pages/
      hooks/
      App.jsx
    package.json
    tailwind.config.js
  README.md

## Conventions
- Python: PEP8, snake_case, type hints on function signatures
- JavaScript: camelCase, functional components with hooks only, no class components
- Tailwind utility classes only, avoid custom CSS files unless truly needed
- Commit messages: short, present tense, describe the change not the file

## Current status
Nothing built yet. This file is the starting brief for Claude Code.
