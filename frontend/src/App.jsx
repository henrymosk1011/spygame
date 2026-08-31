import { useCallback, useEffect, useReducer } from "react";
import useWebSocket from "./hooks/useWebSocket.js";
import JoinScreen from "./pages/JoinScreen.jsx";
import LobbyScreen from "./pages/LobbyScreen.jsx";
import RoleRevealScreen from "./pages/RoleRevealScreen.jsx";
import TimerScreen from "./pages/TimerScreen.jsx";
import VoteCallScreen from "./pages/VoteCallScreen.jsx";
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
  spyCount: 1,
  lastSpyReveal: null,
  voteCall: null,
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
        lastSpyReveal: null,
        voteCall: null,
        vote: { candidates: [], votedIds: [] },
        caughtInfo: null,
        roundEnd: null,
      };
    case "role_reveal":
      return { ...state, screen: "role", role: message.role, location: message.location ?? null };
    case "timer_start":
      return {
        ...state,
        timer: { duration: message.duration, startedAt: message.started_at },
        spyCount: message.spy_count,
      };
    case "vote_call_started":
      return {
        ...state,
        screen: "vote_call",
        voteCall: { callerId: message.caller_id, callerName: message.caller_name, responses: message.responses },
      };
    case "vote_call_update":
      return { ...state, voteCall: { ...state.voteCall, responses: message.responses } };
    case "vote_call_cancelled":
      return { ...state, screen: "timer", voteCall: null };
    case "vote_started":
      return {
        ...state,
        screen: "voting",
        voteCall: null,
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
    case "spy_revealed_round_continues":
      return {
        ...state,
        screen: "timer",
        vote: { candidates: [], votedIds: [] },
        caughtInfo: null,
        lastSpyReveal: {
          name: message.revealed_player_name,
          remaining: message.remaining_spy_count,
        },
      };
    case "round_end":
      return {
        ...state,
        screen: "voting",
        roundEnd: {
          winner: message.winner,
          reason: message.reason,
          spyIds: message.spy_ids,
          spy_names: message.spy_names,
          location: message.location,
        },
      };
    case "error":
      return { ...state, errorMessage: message.message };
    case "LOCAL_ADVANCE_TO_TIMER":
      return { ...state, screen: "timer" };
    case "LOCAL_DISMISS_SPY_REVEAL":
      return { ...state, lastSpyReveal: null };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, sendMessage } = useWebSocket(dispatch);

  // On mobile, focusing a text input scrolls the page to keep it above the on-screen keyboard.
  // The *previous* screen's keyboard-close animation keeps resizing the visual viewport (and
  // re-adjusting scroll) for a while after this screen has already mounted, so a one-shot
  // scrollTo loses that race -- react to the Visual Viewport API's resize event directly
  // instead of guessing a duration, with a few timed fallbacks for browsers without it. This
  // only runs briefly after mount: it has to stop listening well before the user could focus a
  // field on *this* screen (e.g. the lobby's round-length box), or it would fight the browser's
  // own -- wanted -- scroll-to-keep-that-field-visible behavior.
  useEffect(() => {
    const resetScroll = () => window.scrollTo(0, 0);
    resetScroll();

    const timeouts = [50, 100, 150, 250, 350, 500, 750, 1000].map((delay) =>
      setTimeout(resetScroll, delay)
    );

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", resetScroll);
    const stopListening = setTimeout(() => viewport?.removeEventListener("resize", resetScroll), 1200);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(stopListening);
      viewport?.removeEventListener("resize", resetScroll);
    };
  }, [state.screen]);

  const onCreateRoom = useCallback(
    (name) => sendMessage({ type: "create_room", name }),
    [sendMessage]
  );
  const onJoinRoom = useCallback(
    (name, roomCode) => sendMessage({ type: "join_room", room_code: roomCode, name }),
    [sendMessage]
  );
  const onStartRound = useCallback(
    (durationMinutes, spyCount) =>
      sendMessage({ type: "start_round", duration_minutes: durationMinutes, spy_count: spyCount }),
    [sendMessage]
  );
  const onCallVote = useCallback(() => sendMessage({ type: "call_vote" }), [sendMessage]);
  const onRespondVoteCall = useCallback(
    (agree) => sendMessage({ type: "respond_vote_call", agree }),
    [sendMessage]
  );
  const onCancelVoteCall = useCallback(() => sendMessage({ type: "cancel_vote_call" }), [sendMessage]);
  const onCastVote = useCallback(
    (targetId) => sendMessage({ type: "cast_vote", target_id: targetId }),
    [sendMessage]
  );
  const onSpyGuess = useCallback(
    (location) => sendMessage({ type: "spy_guess", location }),
    [sendMessage]
  );
  const onCancelRound = useCallback(() => sendMessage({ type: "cancel_round" }), [sendMessage]);
  const onNewRound = useCallback(() => sendMessage({ type: "new_round" }), [sendMessage]);
  const onReady = useCallback(() => dispatch({ type: "LOCAL_ADVANCE_TO_TIMER" }), []);
  const onDismissSpyReveal = useCallback(() => dispatch({ type: "LOCAL_DISMISS_SPY_REVEAL" }), []);

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
          spyCount={state.spyCount}
          lastSpyReveal={state.lastSpyReveal}
          onDismissSpyReveal={onDismissSpyReveal}
          isHost={state.isHost}
          onCallVote={onCallVote}
          onCancelRound={onCancelRound}
        />
      );
    case "vote_call":
      return (
        <VoteCallScreen
          callerName={state.voteCall?.callerName}
          isCaller={state.selfId === state.voteCall?.callerId}
          hasResponded={Object.prototype.hasOwnProperty.call(state.voteCall?.responses ?? {}, state.selfId)}
          onAgree={() => onRespondVoteCall(true)}
          onDisagree={() => onRespondVoteCall(false)}
          onCancel={onCancelVoteCall}
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
          onCancelRound={onCancelRound}
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
