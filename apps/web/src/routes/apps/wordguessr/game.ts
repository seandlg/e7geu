import { categories, letterWeights, type GameLocale } from './content';

export const finishPosition = 24;

export type TeamInput = { name: string; emoji: string };
export type Team = TeamInput & { id: string; palette: number; position: number };
export type BoardTile = {
  position: number;
  row: number;
  column: number;
  seconds: number | null;
  label: 'start' | 'finish' | null;
};

type GameBase = {
  locale: GameLocale;
  teams: Team[];
  currentTeamIndex: number;
  categoryDeck: number[];
  categoryCursor: number;
};

export type BetweenRoundsGame = GameBase & { phase: 'between-rounds' };
export type ReadyRoundGame = GameBase & {
  phase: 'ready';
  round: { letter: string; seconds: number; skipsLeft: 2 };
};
export type ActiveRoundGame = GameBase & {
  phase: 'active';
  round: {
    letter: string;
    seconds: number;
    skipsLeft: number;
    categoryIndex: number;
    endsAt: number;
  };
};
export type WonGame = GameBase & { phase: 'won'; winnerId: string };
export type Game = BetweenRoundsGame | ReadyRoundGame | ActiveRoundGame | WonGame;

export type GameEvent =
  | { type: 'prepare-round' }
  | { type: 'reveal'; now: number }
  | { type: 'accept'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'tick'; now: number };

const tileSeconds = [
  10,
  20,
  30,
  20,
  10,
  20,
  30,
  20,
  30,
  20,
  10,
  20,
  30,
  20,
  10,
  20,
  30,
  20,
  30,
  20,
  10,
  20,
  30,
  20,
  null,
] as const;

export const boardPath: readonly BoardTile[] = tileSeconds.map((seconds, position) => {
  const pathRow = Math.floor(position / 5);
  const offset = position % 5;
  return {
    position,
    row: 5 - pathRow,
    column: pathRow % 2 === 0 ? offset + 1 : 5 - offset,
    seconds,
    label: position === 0 ? 'start' : position === finishPosition ? 'finish' : null,
  };
});

export function createGame(inputs: readonly TeamInput[], locale: GameLocale): BetweenRoundsGame {
  const validTeams = inputs
    .map((team) => ({ ...team, name: team.name.trim() }))
    .filter((team) => team.name.length > 0);
  if (validTeams.length < 1 || validTeams.length > 4) {
    throw new Error('Wordguessr requires between one and four named teams');
  }
  return {
    phase: 'between-rounds',
    locale,
    teams: validTeams.map((team, index) => ({
      ...team,
      id: `team-${index + 1}`,
      palette: index,
      position: 0,
    })),
    currentTeamIndex: 0,
    categoryDeck: [],
    categoryCursor: 0,
  };
}

export function transitionGame(
  game: Game,
  event: GameEvent,
  random: () => number = Math.random,
): Game {
  if (game.phase === 'won') return game;
  if (game.phase === 'active' && 'now' in event && event.now >= game.round.endsAt) {
    return endRound(game);
  }

  switch (event.type) {
    case 'prepare-round': {
      if (game.phase !== 'between-rounds') return game;
      const team = game.teams[game.currentTeamIndex]!;
      const seconds = boardPath[team.position]?.seconds;
      if (seconds === null || seconds === undefined) return game;
      return {
        ...game,
        phase: 'ready',
        round: { letter: drawLetter(random), seconds, skipsLeft: 2 },
      };
    }
    case 'reveal': {
      if (game.phase !== 'ready') return game;
      const draw = drawCategory(game, random);
      return {
        ...game,
        ...draw,
        phase: 'active',
        round: {
          ...game.round,
          categoryIndex: draw.categoryIndex,
          endsAt: event.now + game.round.seconds * 1000,
        },
      };
    }
    case 'accept': {
      if (game.phase !== 'active') return game;
      const teams = game.teams.map((team, index) =>
        index === game.currentTeamIndex
          ? { ...team, position: Math.min(finishPosition, team.position + 1) }
          : team,
      );
      const currentTeam = teams[game.currentTeamIndex]!;
      if (currentTeam.position === finishPosition) {
        return {
          phase: 'won',
          locale: game.locale,
          teams,
          currentTeamIndex: game.currentTeamIndex,
          categoryDeck: game.categoryDeck,
          categoryCursor: game.categoryCursor,
          winnerId: currentTeam.id,
        };
      }
      const draw = drawCategory(game, random);
      return {
        ...game,
        ...draw,
        teams,
        round: { ...game.round, categoryIndex: draw.categoryIndex },
      };
    }
    case 'skip': {
      if (game.phase !== 'active' || game.round.skipsLeft <= 0) return game;
      const draw = drawCategory(game, random);
      return {
        ...game,
        ...draw,
        round: {
          ...game.round,
          categoryIndex: draw.categoryIndex,
          skipsLeft: game.round.skipsLeft - 1,
        },
      };
    }
    case 'tick':
      return game;
  }
}

export function timeRemaining(game: Game, now: number): number {
  if (game.phase !== 'active') return 0;
  return Math.max(0, Math.ceil((game.round.endsAt - now) / 1000));
}

export function currentCategory(game: Game): string | null {
  return game.phase === 'active'
    ? (categories[game.locale][game.round.categoryIndex] ?? null)
    : null;
}

function endRound(game: ActiveRoundGame): BetweenRoundsGame {
  return {
    phase: 'between-rounds',
    locale: game.locale,
    teams: game.teams,
    currentTeamIndex: (game.currentTeamIndex + 1) % game.teams.length,
    categoryDeck: game.categoryDeck,
    categoryCursor: game.categoryCursor,
  };
}

function drawCategory(
  game: GameBase,
  random: () => number,
): { categoryDeck: number[]; categoryCursor: number; categoryIndex: number } {
  let deck = game.categoryDeck;
  let cursor = game.categoryCursor;
  if (deck.length === 0 || cursor >= deck.length) {
    deck = shuffle(
      categories[game.locale].map((_, index) => index),
      random,
    );
    cursor = 0;
  }
  return {
    categoryDeck: deck,
    categoryCursor: cursor + 1,
    categoryIndex: deck[cursor]!,
  };
}

function drawLetter(random: () => number): string {
  const entries = Object.entries(letterWeights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const target = random() * total;
  let cumulative = 0;
  for (const [letter, weight] of entries) {
    cumulative += weight;
    if (target < cumulative) return letter;
  }
  return entries.at(-1)![0];
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}
