"""Pure game rules: assigning roles, tallying votes, deciding winners."""
import random

from app.rooms import Room

LOCATIONS = [
    "Airplane",
    "Bank",
    "Beach",
    "Casino",
    "Circus Tent",
    "Corporate Party",
    "Day Spa",
    "Embassy",
    "Hospital",
    "Hotel",
    "Military Base",
    "Movie Studio",
    "Ocean Liner",
    "Passenger Train",
    "Pirate Ship",
    "Police Station",
    "Restaurant",
    "School",
    "Space Station",
    "Submarine",
    "Supermarket",
    "Theater",
]

MIN_PLAYERS = 3


def assign_spy_and_location(room: Room) -> None:
    """Pick a random spy and location for the given room, mutating it in place."""
    player_ids = list(room.players.keys())
    room.spy_id = random.choice(player_ids)
    room.location = random.choice(LOCATIONS)


def tally_votes(room: Room) -> str | None:
    """Return the player id with the most votes, or None if there is no single winner."""
    if not room.votes:
        return None
    counts: dict[str, int] = {}
    for target_id in room.votes.values():
        counts[target_id] = counts.get(target_id, 0) + 1
    top_count = max(counts.values())
    top_targets = [pid for pid, count in counts.items() if count == top_count]
    if len(top_targets) != 1:
        return None
    return top_targets[0]


def vote_is_unanimous_and_complete(room: Room) -> bool:
    """All connected players must have voted before a vote resolves."""
    connected_ids = {p.id for p in room.connected_players()}
    return connected_ids.issubset(room.votes.keys()) and len(connected_ids) > 0


def spy_wins_by_guess(room: Room, guessed_location: str) -> bool:
    return guessed_location.strip().lower() == (room.location or "").strip().lower()
