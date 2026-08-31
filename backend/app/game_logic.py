"""Pure game rules: assigning roles, tallying votes, deciding winners."""
import random

from app.rooms import Room

LOCATIONS = [
    "Airplane",
    "Airport",
    "Bank",
    "Beach",
    "Beetle",
    "Bookstore",
    "Burger",
    "Candy",
    "Casino",
    "Chef",
    "Chocolate",
    "Cinema",
    "Circus Tent",
    "Coffee",
    "Cook",
    "Corporate Party",
    "Cushion",
    "Day Spa",
    "Doctor",
    "Dolphin",
    "Earphones",
    "Elephant",
    "Embassy",
    "Firefighter",
    "Flight Attendant",
    "Gelato",
    "Headphones",
    "Hospital",
    "Hotel",
    "Ice Cream",
    "Lemonade",
    "Library",
    "Lion",
    "Military Base",
    "Mirror",
    "Movie Studio",
    "Nurse",
    "Ocean Liner",
    "Passenger Train",
    "Penguin",
    "Pharmacy",
    "Pillow",
    "Pilot",
    "Pizza",
    "Polar Bear",
    "Police Officer",
    "Police Station",
    "Professor",
    "Raincoat",
    "Restaurant",
    "Rhinoceros",
    "Sashimi",
    "School",
    "Space Station",
    "Spider",
    "Submarine",
    "Supermarket",
    "Sushi",
    "Swimming Pool",
    "Tea",
    "Teacher",
    "Theater",
    "Tiger",
    "Toothbrush",
    "Toothpaste",
    "Train Station",
    "Umbrella",
    "Whale",
    "Window",
]

MIN_PLAYERS = 3


def max_spies_for(player_count: int) -> int:
    """Cap spies at a strict minority of the table, and never fewer than one."""
    return max(1, (player_count - 1) // 2)


def assign_spy_and_location(room: Room, spy_count: int) -> None:
    """Pick `spy_count` random spies and a random location, mutating the room in place."""
    player_ids = list(room.players.keys())
    room.spy_ids = random.sample(player_ids, k=min(spy_count, len(player_ids)))
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
