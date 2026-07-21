export const suits = ['ember', 'tide', 'grove', 'gale'] as const;
export type Suit = (typeof suits)[number];

export type SuitCard = { id: string; kind: 'suit'; suit: Suit; rank: number };
export type SpecialCard = { id: string; kind: 'apex' | 'mote' };
export type Card = SuitCard | SpecialCard;

export type Player = {
  id: string;
  name: string;
  score: number;
  bid: number | null;
  tricks: number;
  hand: Card[];
};

export type PlayedCard = { playerId: string; card: Card };

export type LobbyGame = {
  phase: 'lobby';
  players: Player[];
  hostId: string;
};

export type RoundGame = {
  phase: 'choose-trump' | 'bidding' | 'playing' | 'round-over' | 'game-over';
  players: Player[];
  hostId: string;
  round: number;
  maxRounds: number;
  dealerIndex: number;
  activePlayerIndex: number;
  trump: Suit | null;
  turnedCard: Card | null;
  trick: PlayedCard[];
  completedTricks: PlayedCard[][];
  lastTrickWinnerId: string | null;
};

export type Game = LobbyGame | RoundGame;

export type GameAction =
  | { type: 'start' }
  | { type: 'choose-trump'; suit: Suit }
  | { type: 'bid'; bid: number }
  | { type: 'play'; cardId: string }
  | { type: 'next-round' };

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({ id: `${suit}-${rank}`, kind: 'suit', suit, rank });
    }
  }
  for (let index = 1; index <= 4; index += 1) {
    cards.push({ id: `apex-${index}`, kind: 'apex' });
    cards.push({ id: `mote-${index}`, kind: 'mote' });
  }
  return cards;
}

export function createLobby(hostId: string, hostName: string): LobbyGame {
  return { phase: 'lobby', hostId, players: [createPlayer(hostId, hostName)] };
}

export function addPlayer(game: LobbyGame, id: string, name: string): LobbyGame {
  if (game.players.some((player) => player.id === id)) return game;
  if (game.players.length >= 6) throw new Error('This table is full');
  const cleanName = validateName(name);
  return { ...game, players: [...game.players, createPlayer(id, cleanName)] };
}

export function transition(
  game: Game,
  actorId: string,
  action: GameAction,
  random: () => number = Math.random,
): Game {
  switch (action.type) {
    case 'start':
      if (game.phase !== 'lobby') return game;
      if (actorId !== game.hostId) throw new Error('Only the host can start the game');
      if (game.players.length < 3) throw new Error('Arcana needs 3 to 6 players');
      return dealRound(game, 1, game.players.length - 1, random);
    case 'choose-trump':
      if (game.phase !== 'choose-trump') return game;
      assertTurn(game, actorId);
      return { ...game, phase: 'bidding', trump: action.suit };
    case 'bid':
      if (game.phase !== 'bidding') return game;
      return placeBid(game, actorId, action.bid);
    case 'play':
      if (game.phase !== 'playing') return game;
      return playCard(game, actorId, action.cardId);
    case 'next-round':
      if (game.phase !== 'round-over') return game;
      if (actorId !== game.hostId) throw new Error('Only the host can deal the next round');
      return dealRound(game, game.round + 1, game.dealerIndex, random);
  }
}

export function legalCards(game: RoundGame, playerId: string): Card[] {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) return [];
  return legalHand(player.hand, game.trick);
}

export function legalHand(hand: readonly Card[], trick: readonly PlayedCard[]): Card[] {
  const lead = leadSuit(trick);
  if (!lead || !hand.some((card) => card.kind === 'suit' && card.suit === lead)) {
    return [...hand];
  }
  return hand.filter((card) => card.kind !== 'suit' || card.suit === lead);
}

export function trickWinner(trick: readonly PlayedCard[], trump: Suit | null): string {
  if (trick.length === 0) throw new Error('An empty trick has no winner');
  const apex = trick.find((play) => play.card.kind === 'apex');
  if (apex) return apex.playerId;
  const suited = trick.filter(
    (play): play is { playerId: string; card: SuitCard } => play.card.kind === 'suit',
  );
  if (suited.length === 0) return trick[0]!.playerId;
  const lead = suited[0]!.card.suit;
  const eligible =
    trump && suited.some((play) => play.card.suit === trump)
      ? suited.filter((play) => play.card.suit === trump)
      : suited.filter((play) => play.card.suit === lead);
  return eligible.reduce((best, play) => (play.card.rank > best.card.rank ? play : best)).playerId;
}

export function scoreRound(player: Pick<Player, 'bid' | 'tricks'>): number {
  if (player.bid === null) throw new Error('Cannot score an incomplete bid');
  return player.bid === player.tricks
    ? 20 + player.tricks * 10
    : -10 * Math.abs(player.bid - player.tricks);
}

function dealRound(
  game: Game,
  round: number,
  previousDealer: number,
  random: () => number,
): RoundGame {
  const maxRounds = Math.floor(60 / game.players.length);
  if (round > maxRounds) throw new Error('No rounds remain');
  const dealerIndex = (previousDealer + 1) % game.players.length;
  const deck = shuffle(createDeck(), random);
  const players = game.players.map((player) => ({
    ...player,
    bid: null,
    tricks: 0,
    hand: [] as Card[],
  }));
  let cursor = 0;
  for (let card = 0; card < round; card += 1) {
    for (let offset = 1; offset <= players.length; offset += 1) {
      players[(dealerIndex + offset) % players.length]!.hand.push(deck[cursor++]!);
    }
  }
  const turnedCard = deck[cursor] ?? null;
  const phase = turnedCard?.kind === 'apex' ? 'choose-trump' : 'bidding';
  const trump = turnedCard?.kind === 'suit' ? turnedCard.suit : null;
  const firstPlayer = (dealerIndex + 1) % players.length;
  return {
    phase,
    players,
    hostId: game.hostId,
    round,
    maxRounds,
    dealerIndex,
    activePlayerIndex: phase === 'choose-trump' ? dealerIndex : firstPlayer,
    trump,
    turnedCard,
    trick: [],
    completedTricks: [],
    lastTrickWinnerId: null,
  };
}

function placeBid(game: RoundGame, actorId: string, bid: number): RoundGame {
  assertTurn(game, actorId);
  if (!Number.isInteger(bid) || bid < 0 || bid > game.round) throw new Error('Choose a valid bid');
  const players = game.players.map((player) => ({ ...player }));
  players[game.activePlayerIndex]!.bid = bid;
  const bidsComplete = players.every((player) => player.bid !== null);
  if (bidsComplete) {
    const total = players.reduce((sum, player) => sum + player.bid!, 0);
    if (total === game.round)
      throw new Error(`The dealer cannot make the bids total ${game.round}`);
    return {
      ...game,
      players,
      phase: 'playing',
      activePlayerIndex: (game.dealerIndex + 1) % players.length,
    };
  }
  return { ...game, players, activePlayerIndex: (game.activePlayerIndex + 1) % players.length };
}

function playCard(game: RoundGame, actorId: string, cardId: string): RoundGame {
  assertTurn(game, actorId);
  const player = game.players[game.activePlayerIndex]!;
  const card = player.hand.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error('That card is not in your hand');
  if (!legalCards(game, actorId).some((candidate) => candidate.id === cardId)) {
    throw new Error('You must follow the led suit');
  }
  const players = game.players.map((candidate) => ({ ...candidate, hand: [...candidate.hand] }));
  players[game.activePlayerIndex]!.hand = player.hand.filter(
    (candidate) => candidate.id !== cardId,
  );
  const trick = [...game.trick, { playerId: actorId, card }];
  if (trick.length < players.length) {
    return {
      ...game,
      players,
      trick,
      activePlayerIndex: (game.activePlayerIndex + 1) % players.length,
    };
  }
  const winnerId = trickWinner(trick, game.trump);
  const winnerIndex = players.findIndex((candidate) => candidate.id === winnerId);
  players[winnerIndex]!.tricks += 1;
  if (players.every((candidate) => candidate.hand.length === 0)) {
    for (const scored of players) scored.score += scoreRound(scored);
    const phase = game.round === game.maxRounds ? 'game-over' : 'round-over';
    return {
      ...game,
      phase,
      players,
      trick,
      completedTricks: [...game.completedTricks, trick],
      lastTrickWinnerId: winnerId,
      activePlayerIndex: winnerIndex,
    };
  }
  return {
    ...game,
    players,
    trick: [],
    completedTricks: [...game.completedTricks, trick],
    lastTrickWinnerId: winnerId,
    activePlayerIndex: winnerIndex,
  };
}

function leadSuit(trick: readonly PlayedCard[]): Suit | null {
  return (
    trick.find((play): play is { playerId: string; card: SuitCard } => play.card.kind === 'suit')
      ?.card.suit ?? null
  );
}

function assertTurn(game: RoundGame, actorId: string): void {
  if (game.players[game.activePlayerIndex]?.id !== actorId) throw new Error('It is not your turn');
}

function createPlayer(id: string, name: string): Player {
  return { id, name: validateName(name), score: 0, bid: null, tricks: 0, hand: [] };
}

function validateName(name: string): string {
  const cleanName = name.trim().slice(0, 24);
  if (!cleanName) throw new Error('Enter a name');
  return cleanName;
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}
