import { useCallback, useReducer } from "react";
import useWebSocket from "./hooks/useWebSocket.js";
import JoinScreen from "./pages/JoinScreen.jsx";
import LobbyScreen from "./pages/LobbyScreen.jsx";
import RoleRevealScreen from "./pages/RoleRevealScreen.jsx";
import TimerScreen from "./pages/TimerScreen.jsx";
import VotingScreen from "./pages/VotingScreen.jsx";

const initialState = {
  screen: "join",
  roomCode: null,
  selfId: null,
  isHost: false,
  players: [],
  role: null,
  location: null,
  timer: null,
  vote: { candidates: [], votedIds: [] },
  caughtInfo: null,
  roundEnd: null,
  errorMessage: null,
};

function reducer(state, message) {
  switch (message.type) {
    case "room_created":
    case "room_joined":
      return {
        ...initialState,
        screen: "lobby",
        roomCode: message.room_code,
        selfId: message.player_id,
        isHost: message.is_host,
        players: message.players,
      };
    case "lobby_update":
      return {
        ...state,
        screen: "lobby",
        players: message.players,
        role: null,
        location: null,
        timer: null,
        vote: { candidates: [], votedIds: [] },
        caughtInfo: null,
        roundEnd: null,
      };
    case "role_reveal":
      return { ...state, screen: "role", role: message.role, location: message.location ?? null };
    case "timer_start":
      return { ...state, timer: { duration: message.duration, startedAt: message.started_at } };
    case "vote_started":
      return {
        ...state,
        screen: "voting",
        vote: { candidates: message.candidates, votedIds: [] },
        caughtInfo: null,
        roundEnd: null,
      };
    case "vote_update":
      return { ...state, vote: { ...state.vote, votedIds: message.voted_player_ids } };
    case "spy_caught":
      return {
        ...state,
        caughtInfo: { accused_id: message.accused_id, accused_name: message.accused_name },
      };
    case "vote_failed":
      return { ...state, screen: "timer", vote: { candidates: [], votedIds: [] }, caughtInfo: null };
    case "round_end":
      return {
        ...state,
        screen: "voting",
        roundEnd: {
          winner: message.winner,
          reason: message.reason,
          spyId: message.spy_id,
          spy_name: message.spy_name,
          location: message.location,
        },
      };
    case "error":
      return { ...state, errorMessage: message.message };
    case "LOCAL_ADVANCE_TO_TIMER":
      return { ...state, screen: "timer" };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, sendMessage } = useWebSocket(dispatch);

  const onCreateRoom = useCallback(
    (name) => sendMessage({ type: "create_room", name }),
    [sendMessage]
  );
  const onJoinRoom = useCallback(
    (name, roomCode) => sendMessage({ type: "join_room", room_code: roomCode, name }),
    [sendMessage]
  );
  const onStartRound = useCallback(() => sendMessage({ type: "start_round" }), [sendMessage]);
  const onCallVote = useCallback(() => sendMessage({ type: "call_vote" }), [sendMessage]);
  const onCastVote = useCallback(
    (targetId) => sendMessage({ type: "cast_vote", target_id: targetId }),
    [sendMessage]
  );
  const onSpyGuess = useCallback(
    (location) => sendMessage({ type: "spy_guess", location }),
    [sendMessage]
  );
  const onNewRound = useCallback(() => sendMessage({ type: "new_round" }), [sendMessage]);
  const onReady = useCallback(() => dispatch({ type: "LOCAL_ADVANCE_TO_TIMER" }), []);

  switch (state.screen) {
    case "lobby":
      return (
        <LobbyScreen
          roomCode={state.roomCode}
          players={state.players}
          selfId={state.selfId}
          isHost={state.isHost}
          onStartRound={onStartRound}
          errorMessage={state.errorMessage}
        />
      );
    case "role":
      return <RoleRevealScreen role={state.role} location={state.location} onReady={onReady} />;
    case "timer":
      return (
        <TimerScreen
          duration={state.timer?.duration ?? 0}
          startedAt={state.timer?.startedAt ?? Date.now() / 1000}
          role={state.role}
          location={state.location}
          onCallVote={onCallVote}
        />
      );
    case "voting":
      return (
        <VotingScreen
          candidates={state.vote.candidates}
          votedIds={state.vote.votedIds}
          selfId={state.selfId}
          isHost={state.isHost}
          caughtInfo={state.caughtInfo}
          roundEnd={state.roundEnd}
          onCastVote={onCastVote}
          onSpyGuess={onSpyGuess}
          onNewRound={onNewRound}
        />
      );
    case "join":
    default:
      return (
        <JoinScreen
          onCreateRoom={onCreateRoom}
          onJoinRoom={onJoinRoom}
          errorMessage={state.errorMessage}
          connectionStatus={status}
        />
      );
  }
}
