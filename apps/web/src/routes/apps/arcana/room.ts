import {
  addPlayer,
  createLobby,
  transition,
  type Card,
  type Game,
  type GameAction,
  type LobbyGame,
  type RoundGame,
  type Suit,
} from './game';

export type PlayerView = {
  id: string;
  name: string;
  score: number;
  bid: number | null;
  tricks: number;
  handSize: number;
};

type PrivateView = {
  players: PlayerView[];
  selfId: string;
  hand: Card[];
};

export type GameView =
  | (Omit<LobbyGame, 'players'> & PrivateView)
  | (Omit<RoundGame, 'players'> & PrivateView);

export type RoomRequest =
  | { type: 'join'; secret: string; name: string }
  | { type: 'sync'; secret: string }
  | { type: 'action'; secret: string; action: GameAction };

export type RoomResponse = { ok: true; view: GameView } | { ok: false; error: string };

export class HostRoom {
  #game: Game;
  readonly #secret: string;

  constructor(hostId: string, hostName: string, secret: string) {
    this.#game = createLobby(hostId, hostName);
    this.#secret = secret;
  }

  get game(): Game {
    return this.#game;
  }

  handle(playerId: string, request: RoomRequest): RoomResponse {
    try {
      if (request.secret !== this.#secret) throw new Error('This invite is not valid');
      if (request.type === 'join') {
        if (this.#game.phase !== 'lobby') throw new Error('This game has already started');
        this.#game = addPlayer(this.#game, playerId, request.name);
      } else {
        if (!this.#game.players.some((player) => player.id === playerId)) {
          throw new Error('Join the table before playing');
        }
        if (request.type === 'action')
          this.#game = transition(this.#game, playerId, request.action);
      }
      return { ok: true, view: toView(this.#game, playerId) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong' };
    }
  }
}

export function toView(game: Game, selfId: string): GameView {
  const self = game.players.find((player) => player.id === selfId);
  if (!self) throw new Error('Player is not seated at this table');
  return {
    ...game,
    players: game.players.map(({ hand, ...player }) => ({ ...player, handSize: hand.length })),
    selfId,
    hand: [...self.hand],
  };
}

export function parseRoomRequest(value: string): RoomRequest {
  const request: unknown = JSON.parse(value);
  if (
    !isRecord(request) ||
    typeof request.type !== 'string' ||
    typeof request.secret !== 'string'
  ) {
    throw new Error('Malformed room request');
  }
  if (request.type === 'join' && typeof request.name === 'string') return request as RoomRequest;
  if (request.type === 'sync') return request as RoomRequest;
  if (request.type === 'action' && isGameAction(request.action)) return request as RoomRequest;
  throw new Error('Malformed room request');
}

function isGameAction(value: unknown): value is GameAction {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'start' || value.type === 'next-round') return true;
  if (value.type === 'bid') return typeof value.bid === 'number';
  if (value.type === 'play') return typeof value.cardId === 'string';
  return value.type === 'choose-trump' && isSuit(value.suit);
}

function isSuit(value: unknown): value is Suit {
  return value === 'ember' || value === 'tide' || value === 'grove' || value === 'gale';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
