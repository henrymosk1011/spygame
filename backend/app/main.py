"""FastAPI app exposing a single WebSocket endpoint that speaks the Spy Game protocol.

Message protocol (all messages are JSON objects with a "type" field):

Client -> server:
  ping              {}                (keepalive; works before joining a room too)
  create_room       {name}
  join_room         {room_code, name}
  start_round       {duration_minutes?, spy_count?}  (host only, needs >= MIN_PLAYERS)
  call_vote         {}                (any player, opens a vote_call_pending phase)
  respond_vote_call {agree}           (any non-caller, while a vote call is pending)
  cancel_vote_call  {}                (the caller only, while a vote call is pending)
  cast_vote         {target_id}       (any connected player, while a vote is active)
  spy_guess         {location}        (the caught spy only, while their guess is pending)
  cancel_round      {}                (host only, ends the round with no winner)
  new_round         {}                (host only, returns everyone to the lobby)

Server -> client:
  pong                   {}
  room_created           {room_code, player_id, players, is_host}
  room_joined            {room_code, player_id, players, is_host}
  error                  {message}
  lobby_update           {room_code, players}
  role_reveal            {role, location?}                 (sent privately to each player)
  timer_start            {duration, started_at, spy_count}
  vote_call_started      {caller_id, caller_name, responses}
  vote_call_update       {responses}
  vote_call_approved     {}
  vote_call_cancelled    {reason}
  vote_started           {candidates}
  vote_update            {voted_player_ids}
  vote_failed            {reason}
  spy_caught             {accused_id, accused_name}
  spy_guess_pending      {}                              (sent privately to the caught spy)
  spy_revealed_round_continues {revealed_player_id, revealed_player_name, remaining_spy_count}
  round_end              {winner, reason, spy_ids, spy_names, location}
"""
import asyncio
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.game_logic import (
    MIN_PLAYERS,
    assign_spy_and_location,
    max_spies_for,
    spy_wins_by_guess,
    tally_votes,
    vote_is_unanimous_and_complete,
)
from app.rooms import Player, Room, RoomManager
from app.websocket_manager import broadcast, broadcast_lobby_update, send_to_player

MIN_ROUND_MINUTES = 1
MAX_ROUND_MINUTES = 30
DEFAULT_ROUND_MINUTES = 8
DEFAULT_SPY_COUNT = 1

app = FastAPI(title="Spy Game")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = RoomManager()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


async def start_round_timer(room: Room) -> None:
    try:
        await asyncio.sleep(room.round_duration)
    except asyncio.CancelledError:
        return
    if room.state in ("timer", "voting", "vote_call_pending"):
        await end_round(room, winner="spy", reason="time_up")


async def send_role_reveals(room: Room) -> None:
    for player in room.players.values():
        if player.id in room.spy_ids:
            await send_to_player(room, player.id, {"type": "role_reveal", "role": "spy"})
        else:
            await send_to_player(
                room,
                player.id,
                {"type": "role_reveal", "role": "civilian", "location": room.location},
            )


async def end_round(room: Room, winner: str, reason: str) -> None:
    room.cancel_timer()
    room.state = "round_end"
    room.vote_active = False
    room.spy_guess_pending = False
    room.vote_call_pending = False
    spy_names = [room.players[sid].name for sid in room.spy_ids if sid in room.players]
    await broadcast(
        room,
        {
            "type": "round_end",
            "winner": winner,
            "reason": reason,
            "spy_ids": room.spy_ids,
            "spy_names": spy_names,
            "location": room.location,
        },
    )


async def resolve_vote_call_if_decided(room: Room) -> None:
    if not room.vote_call_pending:
        return
    connected_ids = {p.id for p in room.connected_players()}
    responses = {pid: agree for pid, agree in room.vote_call_responses.items() if pid in connected_ids}
    total = len(connected_ids)
    majority = total // 2 + 1
    agree_count = sum(1 for agree in responses.values() if agree)
    disagree_count = sum(1 for agree in responses.values() if not agree)

    if agree_count >= majority:
        room.vote_call_pending = False
        room.vote_call_caller_id = None
        room.vote_call_responses = {}
        room.state = "voting"
        room.vote_active = True
        room.votes = {}
        await broadcast(room, {"type": "vote_call_approved"})
        await broadcast(room, {"type": "vote_started", "candidates": room.player_list()})
    elif disagree_count > total - majority:
        room.vote_call_pending = False
        room.vote_call_caller_id = None
        room.vote_call_responses = {}
        room.state = "timer"
        await broadcast(room, {"type": "vote_call_cancelled", "reason": "not_enough_agreement"})


async def resolve_vote(room: Room) -> None:
    accused_id = tally_votes(room)
    room.vote_active = False

    if accused_id is None:
        room.state = "timer"
        await broadcast(room, {"type": "vote_failed", "reason": "no_majority"})
        return

    accused = room.players.get(accused_id)

    if accused_id not in room.spy_ids:
        await end_round(room, winner="spy", reason="wrong_vote")
        return

    room.pending_caught_spy_id = accused_id
    room.spy_guess_pending = True
    await broadcast(
        room,
        {
            "type": "spy_caught",
            "accused_id": accused_id,
            "accused_name": accused.name if accused else None,
        },
    )
    await send_to_player(room, accused_id, {"type": "spy_guess_pending"})


async def handle_message(room_code_holder: dict, player_id_holder: dict, websocket: WebSocket, message: dict) -> None:
    msg_type = message.get("type")

    if msg_type == "ping":
        await websocket.send_json({"type": "pong"})
        return

    if msg_type == "create_room":
        name = (message.get("name") or "").strip()
        if not name:
            await websocket.send_json({"type": "error", "message": "Name is required."})
            return
        room = manager.create_room()
        player_id = str(uuid.uuid4())
        player = Player(id=player_id, name=name, websocket=websocket, is_host=True)
        room.players[player_id] = player
        room.host_id = player_id
        room_code_holder["code"] = room.code
        player_id_holder["id"] = player_id
        await websocket.send_json(
            {
                "type": "room_created",
                "room_code": room.code,
                "player_id": player_id,
                "is_host": True,
                "players": room.player_list(),
            }
        )
        return

    if msg_type == "join_room":
        code = (message.get("room_code") or "").strip().upper()
        name = (message.get("name") or "").strip()
        room = manager.get_room(code)
        if room is None:
            await websocket.send_json({"type": "error", "message": "Room not found."})
            return
        if not name:
            await websocket.send_json({"type": "error", "message": "Name is required."})
            return
        if room.state != "lobby":
            await websocket.send_json({"type": "error", "message": "That round has already started."})
            return
        player_id = str(uuid.uuid4())
        player = Player(id=player_id, name=name, websocket=websocket, is_host=False)
        room.players[player_id] = player
        room_code_holder["code"] = room.code
        player_id_holder["id"] = player_id
        await websocket.send_json(
            {
                "type": "room_joined",
                "room_code": room.code,
                "player_id": player_id,
                "is_host": False,
                "players": room.player_list(),
            }
        )
        await broadcast_lobby_update(room, exclude=player_id)
        return

    room = manager.get_room(room_code_holder.get("code", ""))
    player_id = player_id_holder.get("id")
    if room is None or player_id is None or player_id not in room.players:
        await websocket.send_json({"type": "error", "message": "You are not in a room."})
        return

    if msg_type == "start_round":
        if player_id != room.host_id:
            await websocket.send_json({"type": "error", "message": "Only the host can start the round."})
            return
        connected = room.connected_players()
        if len(connected) < MIN_PLAYERS:
            await websocket.send_json(
                {"type": "error", "message": f"Need at least {MIN_PLAYERS} players to start."}
            )
            return

        try:
            duration_minutes = int(message.get("duration_minutes", DEFAULT_ROUND_MINUTES))
        except (TypeError, ValueError):
            duration_minutes = DEFAULT_ROUND_MINUTES
        duration_minutes = max(MIN_ROUND_MINUTES, min(MAX_ROUND_MINUTES, duration_minutes))

        try:
            spy_count = int(message.get("spy_count", DEFAULT_SPY_COUNT))
        except (TypeError, ValueError):
            spy_count = DEFAULT_SPY_COUNT
        spy_count = max(1, min(max_spies_for(len(connected)), spy_count))

        room.round_duration = duration_minutes * 60
        assign_spy_and_location(room, spy_count)
        room.caught_spy_ids = []
        room.state = "role_reveal"
        await send_role_reveals(room)
        room.state = "timer"
        room.round_started_at = time.time()
        room.cancel_timer()
        room.timer_task = asyncio.create_task(start_round_timer(room))
        await broadcast(
            room,
            {
                "type": "timer_start",
                "duration": room.round_duration,
                "started_at": room.round_started_at,
                "spy_count": len(room.spy_ids),
            },
        )
        return

    if msg_type == "call_vote":
        if room.state != "timer":
            await websocket.send_json({"type": "error", "message": "You can't call a vote right now."})
            return
        caller = room.players[player_id]
        room.state = "vote_call_pending"
        room.vote_call_pending = True
        room.vote_call_caller_id = player_id
        room.vote_call_responses = {player_id: True}
        await broadcast(
            room,
            {
                "type": "vote_call_started",
                "caller_id": player_id,
                "caller_name": caller.name,
                "responses": room.vote_call_responses,
            },
        )
        await resolve_vote_call_if_decided(room)
        return

    if msg_type == "respond_vote_call":
        if room.state != "vote_call_pending" or not room.vote_call_pending:
            await websocket.send_json({"type": "error", "message": "There is no vote call to respond to."})
            return
        if player_id == room.vote_call_caller_id:
            await websocket.send_json({"type": "error", "message": "You already called this vote."})
            return
        room.vote_call_responses[player_id] = bool(message.get("agree"))
        await broadcast(room, {"type": "vote_call_update", "responses": room.vote_call_responses})
        await resolve_vote_call_if_decided(room)
        return

    if msg_type == "cancel_vote_call":
        if room.state != "vote_call_pending" or player_id != room.vote_call_caller_id:
            await websocket.send_json({"type": "error", "message": "You can't cancel this vote call."})
            return
        room.vote_call_pending = False
        room.vote_call_caller_id = None
        room.vote_call_responses = {}
        room.state = "timer"
        await broadcast(room, {"type": "vote_call_cancelled", "reason": "caller_cancelled"})
        return

    if msg_type == "cancel_round":
        if player_id != room.host_id:
            await websocket.send_json({"type": "error", "message": "Only the host can cancel the round."})
            return
        if room.state not in ("timer", "voting", "vote_call_pending"):
            await websocket.send_json({"type": "error", "message": "No round is in progress."})
            return
        await end_round(room, winner="none", reason="cancelled")
        return

    if msg_type == "cast_vote":
        target_id = message.get("target_id")
        if not room.vote_active:
            await websocket.send_json({"type": "error", "message": "No vote is active."})
            return
        if target_id not in room.players:
            await websocket.send_json({"type": "error", "message": "Unknown player."})
            return
        room.votes[player_id] = target_id
        await broadcast(room, {"type": "vote_update", "voted_player_ids": list(room.votes.keys())})
        if vote_is_unanimous_and_complete(room):
            await resolve_vote(room)
        return

    if msg_type == "spy_guess":
        if player_id != room.pending_caught_spy_id or not room.spy_guess_pending:
            await websocket.send_json({"type": "error", "message": "You can't guess right now."})
            return
        guess = message.get("location", "")
        room.spy_guess_pending = False
        if spy_wins_by_guess(room, guess):
            await end_round(room, winner="spy", reason="spy_guessed_correctly")
            return

        room.caught_spy_ids.append(player_id)
        room.pending_caught_spy_id = None
        remaining = [sid for sid in room.spy_ids if sid not in room.caught_spy_ids]
        if not remaining:
            await end_round(room, winner="players", reason="all_spies_caught")
            return

        room.state = "timer"
        caught_player = room.players.get(player_id)
        await broadcast(
            room,
            {
                "type": "spy_revealed_round_continues",
                "revealed_player_id": player_id,
                "revealed_player_name": caught_player.name if caught_player else None,
                "remaining_spy_count": len(remaining),
            },
        )
        return

    if msg_type == "new_round":
        if player_id != room.host_id:
            await websocket.send_json({"type": "error", "message": "Only the host can start a new round."})
            return
        room.reset_for_new_round()
        await broadcast_lobby_update(room)
        return

    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    room_code_holder: dict = {}
    player_id_holder: dict = {}
    try:
        while True:
            message = await websocket.receive_json()
            await handle_message(room_code_holder, player_id_holder, websocket, message)
    except WebSocketDisconnect:
        pass
    finally:
        code = room_code_holder.get("code")
        player_id = player_id_holder.get("id")
        if code and player_id:
            room = manager.get_room(code)
            if room and player_id in room.players:
                room.players[player_id].connected = False
                if room.state == "lobby":
                    del room.players[player_id]
                    if player_id == room.host_id and room.players:
                        new_host = next(iter(room.players.values()))
                        new_host.is_host = True
                        room.host_id = new_host.id
                    await broadcast_lobby_update(room)
                manager.remove_room_if_empty(code)


# Serve the built frontend (frontend/dist) so a single deployed service can host both the
# API/WebSocket and the UI on one public URL. Absent in local dev unless `npm run build` has
# been run, so this is skipped entirely when the frontend is served separately by Vite.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str) -> FileResponse:
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
