"""FastAPI app exposing a single WebSocket endpoint that speaks the Spy Game protocol.

Message protocol (all messages are JSON objects with a "type" field):

Client -> server:
  create_room  {name}
  join_room    {room_code, name}
  start_round  {}                (host only, needs >= MIN_PLAYERS)
  call_vote    {}                (any player, once a round is underway)
  cast_vote    {target_id}       (any connected player, while a vote is active)
  spy_guess    {location}        (the spy only, while their guess is pending)
  new_round    {}                (host only, returns everyone to the lobby)

Server -> client:
  room_created   {room_code, player_id, players, is_host}
  room_joined    {room_code, player_id, players, is_host}
  error          {message}
  lobby_update   {room_code, players}
  role_reveal    {role, location?}                 (sent privately to each player)
  timer_start    {duration, started_at}
  vote_started   {candidates}
  vote_update    {voted_player_ids}
  spy_guess_pending {}                              (sent privately to the spy)
  round_end      {winner, reason, spy_id, spy_name, location}
"""
import asyncio
import time
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.game_logic import (
    MIN_PLAYERS,
    assign_spy_and_location,
    spy_wins_by_guess,
    tally_votes,
    vote_is_unanimous_and_complete,
)
from app.rooms import Player, Room, RoomManager
from app.websocket_manager import broadcast, broadcast_lobby_update, send_to_player

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
    if room.state in ("timer", "voting"):
        await end_round(room, winner="spy", reason="time_up")


async def send_role_reveals(room: Room) -> None:
    for player in room.players.values():
        if player.id == room.spy_id:
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
    spy = room.players.get(room.spy_id) if room.spy_id else None
    await broadcast(
        room,
        {
            "type": "round_end",
            "winner": winner,
            "reason": reason,
            "spy_id": room.spy_id,
            "spy_name": spy.name if spy else None,
            "location": room.location,
        },
    )


async def resolve_vote(room: Room) -> None:
    accused_id = tally_votes(room)
    room.vote_active = False

    if accused_id is None:
        await broadcast(room, {"type": "vote_failed", "reason": "no_majority"})
        return

    accused = room.players.get(accused_id)

    if accused_id != room.spy_id:
        await end_round(room, winner="spy", reason="wrong_vote")
        return

    room.spy_guess_pending = True
    await broadcast(
        room,
        {
            "type": "spy_caught",
            "accused_id": accused_id,
            "accused_name": accused.name if accused else None,
        },
    )
    await send_to_player(room, room.spy_id, {"type": "spy_guess_pending"})


async def handle_message(room_code_holder: dict, player_id_holder: dict, websocket: WebSocket, message: dict) -> None:
    msg_type = message.get("type")

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
        if len(room.connected_players()) < MIN_PLAYERS:
            await websocket.send_json(
                {"type": "error", "message": f"Need at least {MIN_PLAYERS} players to start."}
            )
            return
        assign_spy_and_location(room)
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
            },
        )
        return

    if msg_type == "call_vote":
        if room.state not in ("timer", "voting"):
            await websocket.send_json({"type": "error", "message": "No round is in progress."})
            return
        room.state = "voting"
        room.vote_active = True
        room.votes = {}
        await broadcast(room, {"type": "vote_started", "candidates": room.player_list()})
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
        if player_id != room.spy_id or not room.spy_guess_pending:
            await websocket.send_json({"type": "error", "message": "You can't guess right now."})
            return
        guess = message.get("location", "")
        room.spy_guess_pending = False
        if spy_wins_by_guess(room, guess):
            await end_round(room, winner="spy", reason="spy_guessed_correctly")
        else:
            await end_round(room, winner="players", reason="spy_guessed_wrong")
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
