"""In-memory room and player state for Spy Game."""
import asyncio
import random
import string
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

ROOM_CODE_LENGTH = 4
ROOM_CODE_ALPHABET = string.ascii_uppercase
DEFAULT_ROUND_DURATION_SECONDS = 8 * 60


@dataclass
class Player:
    id: str
    name: str
    websocket: WebSocket
    is_host: bool = False
    connected: bool = True


@dataclass
class Room:
    code: str
    players: dict[str, Player] = field(default_factory=dict)
    host_id: Optional[str] = None
    # lobby | role_reveal | timer | vote_call_pending | voting | round_end
    state: str = "lobby"
    spy_ids: list[str] = field(default_factory=list)
    caught_spy_ids: list[str] = field(default_factory=list)
    pending_caught_spy_id: Optional[str] = None
    location: Optional[str] = None
    round_duration: int = DEFAULT_ROUND_DURATION_SECONDS
    round_started_at: Optional[float] = None
    votes: dict[str, str] = field(default_factory=dict)
    vote_active: bool = False
    spy_guess_pending: bool = False
    vote_call_pending: bool = False
    vote_call_caller_id: Optional[str] = None
    vote_call_responses: dict[str, bool] = field(default_factory=dict)
    timer_task: Optional[asyncio.Task] = None

    def player_list(self) -> list[dict]:
        return [
            {"id": p.id, "name": p.name, "is_host": p.is_host, "connected": p.connected}
            for p in self.players.values()
        ]

    def connected_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.connected]

    def reset_for_new_round(self) -> None:
        self.cancel_timer()
        self.state = "lobby"
        self.spy_ids = []
        self.caught_spy_ids = []
        self.pending_caught_spy_id = None
        self.location = None
        self.round_started_at = None
        self.votes = {}
        self.vote_active = False
        self.spy_guess_pending = False
        self.vote_call_pending = False
        self.vote_call_caller_id = None
        self.vote_call_responses = {}

    def cancel_timer(self) -> None:
        if self.timer_task is not None and not self.timer_task.done():
            self.timer_task.cancel()
        self.timer_task = None


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}

    def generate_room_code(self) -> str:
        while True:
            code = "".join(random.choices(ROOM_CODE_ALPHABET, k=ROOM_CODE_LENGTH))
            if code not in self.rooms:
                return code

    def create_room(self) -> Room:
        code = self.generate_room_code()
        room = Room(code=code)
        self.rooms[code] = room
        return room

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code.upper())

    def remove_room_if_empty(self, code: str) -> None:
        room = self.rooms.get(code)
        if room and not room.connected_players():
            del self.rooms[code]
