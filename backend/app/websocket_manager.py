"""Helpers for sending JSON messages to players in a room."""
from typing import Any

from app.rooms import Room


async def send_to_player(room: Room, player_id: str, message: dict[str, Any]) -> None:
    player = room.players.get(player_id)
    if player is None or not player.connected:
        return
    try:
        await player.websocket.send_json(message)
    except Exception:
        player.connected = False


async def broadcast(room: Room, message: dict[str, Any], exclude: str | None = None) -> None:
    for player in list(room.players.values()):
        if player.id == exclude:
            continue
        await send_to_player(room, player.id, message)


async def broadcast_lobby_update(room: Room, exclude: str | None = None) -> None:
    await broadcast(
        room,
        {"type": "lobby_update", "room_code": room.code, "players": room.player_list()},
        exclude=exclude,
    )
