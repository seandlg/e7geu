import { describe, expect, it } from 'vite-plus/test';
import { categories, letterWeights } from './content';
import {
  boardPath,
  createGame,
  currentCategory,
  finishPosition,
  timeRemaining,
  transitionGame,
  type ActiveRoundGame,
  type Game,
} from './game';

const teams = [
  { name: 'Dolphins', emoji: '🐬' },
  { name: 'Rockets', emoji: '🚀' },
];
const fixedRandom = () => 0.37;

function activeGame(inputs = teams, now = 1000): ActiveRoundGame {
  let game: Game = createGame(inputs, 'en');
  game = transitionGame(game, { type: 'prepare-round' }, fixedRandom);
  game = transitionGame(game, { type: 'reveal', now }, fixedRandom);
  if (game.phase !== 'active') throw new Error('Expected an active round');
  return game;
}

describe('Wordguessr game', () => {
  it('creates one to four trimmed teams at the start', () => {
    const game = createGame([{ name: '  Solo  ', emoji: '⭐' }], 'de');
    expect(game.teams[0]).toMatchObject({ name: 'Solo', position: 0, id: 'team-1' });
    expect(() => createGame([], 'en')).toThrow();
    expect(() => createGame([...teams, ...teams, teams[0]!], 'en')).toThrow();
  });

  it('builds the exact 25-tile snake board', () => {
    expect(boardPath).toHaveLength(25);
    expect(boardPath[0]).toEqual({
      position: 0,
      row: 5,
      column: 1,
      seconds: 10,
      label: 'start',
    });
    expect(boardPath[5]).toMatchObject({ row: 4, column: 5, seconds: 20 });
    expect(boardPath[finishPosition]).toMatchObject({ row: 1, column: 5, label: 'finish' });
  });

  it('reveals a letter before starting a deadline-based round', () => {
    let game: Game = createGame(teams, 'en');
    game = transitionGame(game, { type: 'prepare-round' }, () => 0);
    expect(game).toMatchObject({ phase: 'ready', round: { letter: 'A', seconds: 10 } });
    game = transitionGame(game, { type: 'reveal', now: 5000 }, fixedRandom);
    expect(game).toMatchObject({ phase: 'active', round: { endsAt: 15_000, skipsLeft: 2 } });
    expect(currentCategory(game)).toBeTruthy();
    expect(timeRemaining(game, 5001)).toBe(10);
  });

  it('accepts multiple answers in one round without resetting its deadline', () => {
    let game: Game = activeGame();
    const firstCategory = currentCategory(game);
    const deadline = game.round.endsAt;
    game = transitionGame(game, { type: 'accept', now: 2000 }, fixedRandom);
    expect(game.phase).toBe('active');
    expect(game.teams[0]?.position).toBe(1);
    expect((game as ActiveRoundGame).round.endsAt).toBe(deadline);
    expect(currentCategory(game)).not.toBe(firstCategory);
  });

  it('allows exactly two skips per round', () => {
    let game: Game = activeGame();
    game = transitionGame(game, { type: 'skip', now: 2000 }, fixedRandom);
    game = transitionGame(game, { type: 'skip', now: 2000 }, fixedRandom);
    const afterTwo = game;
    game = transitionGame(game, { type: 'skip', now: 2000 }, fixedRandom);
    expect(game).toBe(afterTwo);
    expect((game as ActiveRoundGame).round.skipsLeft).toBe(0);
  });

  it('ends at the deadline and rotates to the next team', () => {
    let game: Game = activeGame();
    game = transitionGame(game, { type: 'tick', now: game.round.endsAt });
    expect(game).toMatchObject({ phase: 'between-rounds', currentTeamIndex: 1 });
  });

  it('rejects an answer submitted at or after the deadline', () => {
    let game: Game = activeGame();
    const deadline = game.round.endsAt;
    game = transitionGame(game, { type: 'accept', now: deadline }, fixedRandom);
    expect(game).toMatchObject({ phase: 'between-rounds', currentTeamIndex: 1 });
    expect(game.teams[0]?.position).toBe(0);
  });

  it('ignores events that are invalid for the current phase', () => {
    const game = createGame(teams, 'en');
    expect(transitionGame(game, { type: 'accept', now: 0 }, fixedRandom)).toBe(game);
    expect(transitionGame(game, { type: 'skip', now: 0 }, fixedRandom)).toBe(game);
  });

  it('uses the current board tile to determine the next turn duration', () => {
    let game: Game = activeGame([{ name: 'Solo', emoji: '⭐' }]);
    game = transitionGame(game, { type: 'accept', now: 2000 }, fixedRandom);
    game = transitionGame(game, { type: 'accept', now: 2000 }, fixedRandom);
    if (game.phase !== 'active') throw new Error('Expected an active round');
    game = transitionGame(game, { type: 'tick', now: game.round.endsAt });
    game = transitionGame(game, { type: 'prepare-round' }, fixedRandom);
    expect(game).toMatchObject({ phase: 'ready', round: { seconds: 30 } });
  });

  it('wins immediately upon reaching the finish', () => {
    let game: Game = activeGame([{ name: 'Solo', emoji: '⭐' }]);
    for (let position = 0; position < finishPosition; position += 1) {
      game = transitionGame(game, { type: 'accept', now: 2000 }, fixedRandom);
    }
    expect(game).toMatchObject({
      phase: 'won',
      winnerId: 'team-1',
      teams: [{ position: finishPosition }],
    });
  });

  it('does not repeat a category before exhausting the locale deck', () => {
    let game: Game = createGame([{ name: 'Solo', emoji: '⭐' }], 'en');
    const seen = new Set<string>();
    let now = 0;
    while (seen.size < categories.en.length) {
      game = transitionGame(game, { type: 'prepare-round' }, fixedRandom);
      game = transitionGame(game, { type: 'reveal', now }, fixedRandom);
      if (game.phase !== 'active') throw new Error('Expected an active round');
      seen.add(currentCategory(game)!);
      for (let skip = 0; skip < 2 && seen.size < categories.en.length; skip += 1) {
        game = transitionGame(game, { type: 'skip', now }, fixedRandom);
        seen.add(currentCategory(game)!);
      }
      if (game.phase !== 'active') throw new Error('Expected an active round');
      now = game.round.endsAt;
      game = transitionGame(game, { type: 'tick', now }, fixedRandom);
    }
    expect(seen.size).toBe(categories.en.length);
  });

  it('keeps both languages aligned and excludes X and Y', () => {
    expect(categories.en).toHaveLength(102);
    expect(categories.de).toHaveLength(categories.en.length);
    expect(letterWeights).not.toHaveProperty('X');
    expect(letterWeights).not.toHaveProperty('Y');
  });
});
