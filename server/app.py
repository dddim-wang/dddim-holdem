import os
import uuid
import json
import sqlite3
from datetime import timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)

# --- Setup ---
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-jwt")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=3)
CORS(app, supports_credentials=True)
sio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
jwt = JWTManager(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

# --- DB helpers ---
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

with db() as conn:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()

# --- Card & hand evaluation ---
RANKS = "23456789TJQKA"
SUITS = "SHDC"  # Spades, Hearts, Diamonds, Clubs

@dataclass
class Player:
    sid: str
    name: str
    in_hand: bool = True
    cards: List[str] = field(default_factory=list)
    raises: int = 0  # cumulative count of bets (4 or 8) made
    action_submitted: bool = False
    pot: int = 0

@dataclass
class Game:
    game_id: str
    host_sid: Optional[str] = None
    players: Dict[str, Player] = field(default_factory=dict)  # sid -> Player
    deck: List[str] = field(default_factory=list)
    board: List[str] = field(default_factory=list)
    stage: str = "lobby"  # lobby, preflop, flop2, flop3, turn, river, showdown
    pot: int = 0
    round_actions: Dict[str, str] = field(default_factory=dict)  # sid -> action
    someone_raised: bool = False
    current_bet: int = 0  # highest bet in current round
    raise_made: bool = False  # whether someone has already raised in this round
    max_players: int = 15

    def reset_deck(self):
        self.deck = [r + s for r in RANKS for s in SUITS]
        import random
        random.shuffle(self.deck)

    def deal_to_all(self):
        for p in list(self.players.values()):
            if p.in_hand:
                p.cards = [self.deck.pop(), self.deck.pop()]

    def active_sids(self) -> List[str]:
        return [p.sid for p in self.players.values() if p.in_hand]

    def everyone_acted(self) -> bool:
        for sid in self.active_sids():
            if not self.players[sid].action_submitted and not self.players[sid].name.startswith("Host-"):
                return False
        return True

# All live games by id
GAMES: Dict[str, Game] = {}

# --- Hand evaluator helpers ---
from itertools import combinations

RANK_TO_VAL = {r: i for i, r in enumerate(RANKS, start=2)}

HAND_ORDER = {
    "high": 0,
    "pair": 1,
    "two_pair": 2,
    "three": 3,
    "straight": 4,
    "flush": 5,
    "full_house": 6,
    "four": 7,
    "straight_flush": 8,
}

def card_to_tuple(c: str) -> Tuple[int, str]:
    return (RANK_TO_VAL[c[0]], c[1])

def is_straight(vals: List[int]) -> Optional[int]:
    # vals sorted descending
    uniq = sorted(set(vals), reverse=True)
    # Wheel straight A-2-3-4-5
    if {14,5,4,3,2}.issubset(set(vals)):
        return 5
    for i in range(len(uniq) - 4):
        window = uniq[i:i+5]
        if window[0] - window[4] == 4:
            return window[0]
    return None

def classify_5(cards5: List[str]):
    vals = sorted([card_to_tuple(c)[0] for c in cards5], reverse=True)
    suits = [c[1] for c in cards5]
    ranks = [c[0] for c in cards5]
    is_flush = len(set(suits)) == 1
    top_straight = is_straight(vals)

    # counts
    from collections import Counter
    ctr = Counter(vals)
    counts = sorted(ctr.items(), key=lambda x: (-x[1], -x[0]))  # by count desc, then rank desc

    if is_flush and top_straight:
        return (HAND_ORDER["straight_flush"], top_straight, vals)
    if counts[0][1] == 4:
        # four of a kind
        quad = counts[0][0]
        kicker = max([v for v in vals if v != quad])
        return (HAND_ORDER["four"], quad, [kicker])
    if counts[0][1] == 3 and counts[1][1] == 2:
        # full house
        trips = counts[0][0]
        pair = counts[1][0]
        return (HAND_ORDER["full_house"], trips, [pair])
    if is_flush:
        return (HAND_ORDER["flush"], vals)
    if top_straight:
        return (HAND_ORDER["straight"], top_straight)
    if counts[0][1] == 3:
        trips = counts[0][0]
        kickers = [v for v in vals if v != trips][:2]
        return (HAND_ORDER["three"], trips, kickers)
    if counts[0][1] == 2 and counts[1][1] == 2:
        high_pair = max(counts[0][0], counts[1][0])
        low_pair = min(counts[0][0], counts[1][0])
        kicker = max([v for v in vals if v != high_pair and v != low_pair])
        return (HAND_ORDER["two_pair"], high_pair, low_pair, kicker)
    if counts[0][1] == 2:
        pair = counts[0][0]
        kickers = [v for v in vals if v != pair][:3]
        return (HAND_ORDER["pair"], pair, kickers)
    return (HAND_ORDER["high"], vals)

HAND_NAME = {
    HAND_ORDER["high"]: "High Card",
    HAND_ORDER["pair"]: "One Pair",
    HAND_ORDER["two_pair"]: "Two Pair",
    HAND_ORDER["three"]: "Three of a Kind",
    HAND_ORDER["straight"]: "Straight",
    HAND_ORDER["flush"]: "Flush",
    HAND_ORDER["full_house"]: "Full House",
    HAND_ORDER["four"]: "Four of a Kind",
    HAND_ORDER["straight_flush"]: "Straight Flush",
}

def best_hand(hole: List[str], board: List[str]):
    best = None
    best5 = None
    print(f"DEBUG: Evaluating hand for hole cards {hole} and board {board}")
    for combo in combinations(hole + board, 5):
        score = classify_5(list(combo))
        if (best is None) or (score > best):
            best = score
            best5 = list(combo)
            print(f"DEBUG: New best hand: {combo} with score {score}")
    hand_name = HAND_NAME[best[0]]
    print(f"DEBUG: Final best hand: {best5} with name {hand_name}")
    return best, best5, hand_name

# --- REST: auth & comments & rankings ---
@app.post("/api/register")
def register():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    pw_hash = generate_password_hash(password)
    try:
        with db() as conn:
            conn.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, pw_hash))
            conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "username already exists"}), 409
    # Auto-login after registration by returning access token
    token = create_access_token(identity=username)
    return jsonify({"access_token": token, "username": username})

@app.post("/api/login")
def login():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "invalid credentials"}), 401
    token = create_access_token(identity=username)
    return jsonify({"access_token": token, "username": username})

@app.get("/api/comments")
def get_comments():
    game_id = request.args.get("game_id", "")
    with db() as conn:
        rows = conn.execute(
            "SELECT username, content, created_at FROM comments WHERE game_id=? ORDER BY id DESC LIMIT 50",
            (game_id,)
        ).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/comments")
@jwt_required()
def post_comment():
    data = request.get_json(force=True)
    content = data.get("content", "").strip()
    game_id = data.get("game_id", "").strip()
    username = get_jwt_identity()
    if not content or not game_id:
        return jsonify({"error": "content and game_id required"}), 400
    with db() as conn:
        conn.execute("INSERT INTO comments (game_id, username, content) VALUES (?, ?, ?)", (game_id, username, content))
        conn.commit()
    # Broadcast to room ticker
    sio.emit("new_comment", {"username": username, "content": content}, to=game_id)
    return jsonify({"ok": True})

@app.get("/api/hand-rankings")
def hand_rankings():
    ranks = [
        "Straight Flush",
        "Four of a Kind",
        "Full House",
        "Flush",
        "Straight",
        "Three of a Kind",
        "Two Pair",
        "One Pair",
        "High Card",
    ]
    return jsonify(ranks)

# --- Socket.IO events ---
@sio.on("connect")
def on_connect():
    emit("connected", {"sid": request.sid})

@sio.on("disconnect")
def on_disconnect():
    sid = request.sid
    # Remove from any game
    for g in list(GAMES.values()):
        if sid in g.players:
            name = g.players[sid].name
            del g.players[sid]
            sio.emit("lobby_update", {"count": len(g.players), "max": g.max_players}, to=g.game_id)
            sio.emit("system", {"msg": f"{name} left."}, to=g.game_id)
            break

@sio.on("host_create_game")
def host_create_game(data):
    game_id = uuid.uuid4().hex[:6].upper()
    g = Game(game_id=game_id, host_sid=request.sid)
    GAMES[game_id] = g
    join_room(game_id)
    emit("game_created", {"gameId": game_id})

@sio.on("join_game")
def join_game(data):
    game_id = (data or {}).get("gameId")
    name = (data or {}).get("name", "Player")[:20]
    if game_id not in GAMES:
        return emit("error", {"error": "Game not found"})
    g = GAMES[game_id]
    if len(g.players) >= g.max_players:
        return emit("error", {"error": "Game is full"})
    join_room(game_id)
    g.players[request.sid] = Player(sid=request.sid, name=name)
    sio.emit("lobby_update", {"count": len(g.players), "max": g.max_players}, to=game_id)
    sio.emit("system", {"msg": f"{name} joined."}, to=game_id)
    emit("joined", {"gameId": game_id})

@sio.on("host_start")
def host_start(data):
    print("Host started game.")
    game_id = (data or {}).get("gameId")
    if game_id not in GAMES:
        return emit("error", {"error": "Game not found"})
    g = GAMES[game_id]
    if request.sid != g.host_sid:
        return emit("error", {"error": "Only host can start"})
    # Setup deck and deal
    g.reset_deck()
    g.board = []
    g.pot = 0
    g.stage = "preflop"
    g.someone_raised = False
    g.current_bet = 0
    g.raise_made = False
    for p in g.players.values():
        p.in_hand = True
        p.action_submitted = False
        p.raises = 0
        p.pot = 0
        p.cards = []
    g.deal_to_all()
    # send private cards
    for p in g.players.values():
        sio.emit("your_cards", {"cards": p.cards}, to=p.sid)
    sio.emit("state", serialize_game(g), to=game_id)

@sio.on("player_action")
def player_action(data):
    game_id = (data or {}).get("gameId")
    action = (data or {}).get("action")  # check, bet4, bet8, call, fold, raise
    if game_id not in GAMES:
        return emit("error", {"error": "Game not found"})
    g = GAMES[game_id]
    if request.sid not in g.players:
        return emit("error", {"error": "Not in this game"})
    p = g.players[request.sid]
    if not p.in_hand:
        return
    if p.action_submitted:
        return  # one action per round

    # Check if player needs to call (they're below current bet)
    needs_to_call = p.pot < g.current_bet

    if action == "fold":
        p.in_hand = False
        p.action_submitted = True
    elif action == "check":
        if needs_to_call:
            return emit("error", {"error": "Must call or fold - cannot check"})
        p.action_submitted = True
    elif action == "call":
        if not needs_to_call:
            return emit("error", {"error": "No need to call - you can check"})
        call_amount = g.current_bet - p.pot
        p.pot += call_amount
        g.pot += call_amount
        p.action_submitted = True
    elif action == "bet4":
        # If current bet is 8, bet4 is not allowed (must call 8 or raise to 12)
        if g.current_bet == 8:
            return emit("error", {"error": "Cannot bet 4 when current bet is 8. Must call 8 or raise to 12"})
        # If someone already raised in this round, can't bet 4 anymore
        if g.raise_made:
            return emit("error", {"error": "Someone already raised in this round. You can only call or fold."})
        p.pot += 4
        g.pot += 4
        p.raises += 1
        p.action_submitted = True
        g.someone_raised = True
        g.current_bet = max(g.current_bet, p.pot)
        print(f"Player {p.name} bet 4. Current bet now: {g.current_bet}, Player pot: {p.pot}")
    elif action == "bet8":
        # If someone already raised in this round, can't raise again
        if g.raise_made:
            return emit("error", {"error": "Someone already raised in this round. You can only call or fold."})
        p.pot += 8
        g.pot += 8
        p.raises += 1
        p.action_submitted = True
        g.someone_raised = True
        g.raise_made = True  # Mark that a raise has been made
        g.current_bet = max(g.current_bet, p.pot)
        # Reset action_submitted for all other players so they can act again
        for other_p in g.players.values():
            if other_p.sid != p.sid:
                other_p.action_submitted = False
        print(f"Player {p.name} bet 8. Current bet now: {g.current_bet}, Player pot: {p.pot}")
    else:
        return emit("error", {"error": "Invalid action"})

    sio.emit("state", serialize_game(g), to=game_id)
    if g.everyone_acted():
        sio.emit("round_settled", {"ok": True}, to=game_id)

@sio.on("host_deal_next")
def host_deal_next(data):
    print("Host dealt next cards.")
    game_id = (data or {}).get("gameId")
    print(game_id)
    if game_id not in GAMES:
        return emit("error", {"error": "Game not found"})
    g = GAMES[game_id]
    print(g)
    if request.sid != g.host_sid:
        return emit("error", {"error": "Only host can deal"})

    # Ensure all active players acted
    if not g.everyone_acted() and g.stage != "lobby":
        print("Not all players have acted.")
        return emit("error", {"error": "Wait for all players"})

    # Advance stage & reveal board
    if g.stage == "preflop":
        print("Preflop stage dealing next cards...")
        # reveal 2 (first flop)
        g.board.append(g.deck.pop())
        g.board.append(g.deck.pop())
        g.stage = "flop2"
    elif g.stage == "flop2":
        g.board.append(g.deck.pop())  # third flop card
        g.stage = "flop3"
    elif g.stage == "flop3":
        g.board.append(g.deck.pop())  # turn
        g.stage = "turn"
    elif g.stage == "turn":
        g.board.append(g.deck.pop())  # river
        g.stage = "river"
    elif g.stage == "river":
        g.stage = "showdown"
        winners = compute_winners(g)
        print(f"DEBUG: Sending showdown results: {winners}")
        print(f"DEBUG: Winners array type: {type(winners['winners'])}")
        print(f"DEBUG: Winners array content: {winners['winners']}")
        print(f"DEBUG: Winners array length: {len(winners['winners'])}")
        sio.emit("showdown", winners, to=g.game_id)
        sio.emit("state", serialize_game(g), to=g.game_id)
        return

    # Reset per-round flags for next betting round
    for p in g.players.values():
        if p.in_hand:
            p.action_submitted = False
    g.someone_raised = False
    g.current_bet = 0
    g.raise_made = False

    sio.emit("state", serialize_game(g), to=g.game_id)

@sio.on("request_state")
def request_state(data):
    game_id = (data or {}).get("gameId")
    if game_id in GAMES:
        sio.emit("state", serialize_game(GAMES[game_id]), to=request.sid)

@sio.on("host_reset_round")
def host_reset_round(data):
    game_id = (data or {}).get("gameId")
    if game_id not in GAMES:
        return emit("error", {"error": "Game not found"})
    g = GAMES[game_id]
    if request.sid != g.host_sid:
        return emit("error", {"error": "Only host can reset"})
    # Reset to lobby or immediately start another hand
    g.board = []
    g.pot = 0
    g.stage = "preflop"
    g.someone_raised = False
    g.current_bet = 0
    g.raise_made = False
    g.reset_deck()
    for p in g.players.values():
        p.in_hand = True
        p.action_submitted = False
        p.raises = 0
        p.pot = 0
        p.cards = []
    g.deal_to_all()
    for p in g.players.values():
        sio.emit("your_cards", {"cards": p.cards}, to=p.sid)
    sio.emit("state", serialize_game(g), to=g.game_id)

# --- helpers ---
def compute_winners(g: Game):
    # Determine active players (those who did not fold before showdown)
    contenders = [p for p in g.players.values() if p.in_hand]
    if not contenders:
        return {"winners": [], "hand": None}
    # Compute best hands
    scored = []
    for p in contenders:
        score, five, name = best_hand(p.cards, g.board)
        scored.append((score, p, name, five))
        print(f"DEBUG: Player {p.name} has cards {p.cards}, board is {g.board}, best hand: {name}, score: {score}")
    scored.sort(reverse=True, key=lambda t: t[0])
    top = scored[0][0]
    winners = [s[1].name for s in scored if s[0] == top]
    print(f"DEBUG: Top score is {top}, winners are {winners}")
    print(f"DEBUG: All player names in game: {[p.name for p in g.players.values()]}")
    return {
        "winners": winners,
        "pot": g.pot,
        "board": g.board,
        "hand_name": HAND_NAME[top[0]],  # This is the winning hand name
        "show": [
            {"name": s[1].name, "cards": s[1].cards, "best5": s[3], "score": str(s[0]), "hand_name": s[2]} for s in scored
        ],
    }

def serialize_game(g: Game):
    result = {
        "gameId": g.game_id,
        "stage": g.stage,
        "board": g.board,
        "pot": g.pot,
        "someoneRaised": g.someone_raised,
        "currentBet": g.current_bet,
        "raiseMade": g.raise_made,
        "players": [
            {
                "name": p.name, 
                "inHand": p.in_hand, 
                "raises": p.raises, 
                "acted": p.action_submitted, 
                "pot": p.pot,
                "needsToCall": p.in_hand and p.pot < g.current_bet and not p.action_submitted
            }
            for p in g.players.values()
        ],
        "count": len(g.players),
        "max": g.max_players,
    }
    print(f"Serialized game - Current bet: {g.current_bet}, Raise made: {g.raise_made}, Players: {[(p.name, p.pot, p.in_hand and p.pot < g.current_bet and not p.action_submitted) for p in g.players.values()]}")
    return result

if __name__ == "__main__":
    # Run with eventlet for WebSockets
    import eventlet
    import eventlet.wsgi
    print("Starting server on http://localhost:5000")
    sio.run(app, host="0.0.0.0", port=5000)