import { describe, expect, it } from 'vite-plus/test';
import {
  addPlayer,
  createDeck,
  createLobby,
  legalCards,
  scoreRound,
  transition,
  trickWinner,
  type PlayedCard,
  type RoundGame,
} from './game';

function lobby() {
  return addPlayer(addPlayer(createLobby('a', 'Ada'), 'b', 'Bryn'), 'c', 'Cy');
}

describe('Arcana rules', () => {
  it('builds a unique 60-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(60);
    expect(new Set(deck.map((card) => card.id)).size).toBe(60);
    expect(deck.filter((card) => card.kind === 'apex')).toHaveLength(4);
    expect(deck.filter((card) => card.kind === 'mote')).toHaveLength(4);
  });

  it('requires three players and only lets the host start', () => {
    expect(() => transition(createLobby('a', 'Ada'), 'a', { type: 'start' })).toThrow();
    expect(() => transition(lobby(), 'b', { type: 'start' })).toThrow();
  });

  it('deals one card each and turns a trump card', () => {
    const game = transition(lobby(), 'a', { type: 'start' }, () => 0.99) as RoundGame;
    expect(game.round).toBe(1);
    expect(game.maxRounds).toBe(20);
    expect(game.players.every((player) => player.hand.length === 1)).toBe(true);
    expect(game.turnedCard).not.toBeNull();
  });

  it('makes the dealer choose trump when an Apex is turned', () => {
    const game = transition(lobby(), 'a', { type: 'start' }, () => 0) as RoundGame;
    if (game.phase === 'choose-trump') {
      const dealer = game.players[game.dealerIndex]!;
      const chosen = transition(game, dealer.id, { type: 'choose-trump', suit: 'gale' });
      expect(chosen).toMatchObject({ phase: 'bidding', trump: 'gale' });
    }
  });

  it('enforces the dealer bidding constraint', () => {
    let game = transition(lobby(), 'a', { type: 'start' }, () => 0.6) as RoundGame;
    if (game.phase === 'choose-trump') {
      game = transition(game, game.players[game.dealerIndex]!.id, {
        type: 'choose-trump',
        suit: 'tide',
      }) as RoundGame;
    }
    game = transition(game, game.players[game.activePlayerIndex]!.id, {
      type: 'bid',
      bid: 0,
    }) as RoundGame;
    game = transition(game, game.players[game.activePlayerIndex]!.id, {
      type: 'bid',
      bid: 0,
    }) as RoundGame;
    expect(() =>
      transition(game, game.players[game.activePlayerIndex]!.id, { type: 'bid', bid: 1 }),
    ).toThrow();
    expect(
      transition(game, game.players[game.activePlayerIndex]!.id, { type: 'bid', bid: 0 }).phase,
    ).toBe('playing');
  });

  it('requires following suit but always permits special cards', () => {
    const game = {
      ...transition(lobby(), 'a', { type: 'start' }, () => 0.5),
      phase: 'playing',
      activePlayerIndex: 1,
      trick: [{ playerId: 'a', card: { id: 'ember-5', kind: 'suit', suit: 'ember', rank: 5 } }],
      players: [
        { id: 'a', name: 'Ada', score: 0, bid: 0, tricks: 0, hand: [] },
        {
          id: 'b',
          name: 'Bryn',
          score: 0,
          bid: 0,
          tricks: 0,
          hand: [
            { id: 'ember-2', kind: 'suit', suit: 'ember', rank: 2 },
            { id: 'tide-13', kind: 'suit', suit: 'tide', rank: 13 },
            { id: 'mote-1', kind: 'mote' },
          ],
        },
        { id: 'c', name: 'Cy', score: 0, bid: 0, tricks: 0, hand: [] },
      ],
    } as RoundGame;
    expect(legalCards(game, 'b').map((card) => card.id)).toEqual(['ember-2', 'mote-1']);
  });

  it('resolves Apex, trump, lead suit, and all-Mote tricks', () => {
    const play = (playerId: string, card: PlayedCard['card']): PlayedCard => ({ playerId, card });
    expect(
      trickWinner(
        [
          play('a', { id: 'ember-13', kind: 'suit', suit: 'ember', rank: 13 }),
          play('b', { id: 'tide-1', kind: 'suit', suit: 'tide', rank: 1 }),
        ],
        'tide',
      ),
    ).toBe('b');
    expect(
      trickWinner(
        [play('a', { id: 'apex-1', kind: 'apex' }), play('b', { id: 'apex-2', kind: 'apex' })],
        null,
      ),
    ).toBe('a');
    expect(
      trickWinner(
        [play('a', { id: 'mote-1', kind: 'mote' }), play('b', { id: 'mote-2', kind: 'mote' })],
        null,
      ),
    ).toBe('a');
  });

  it('scores exact and missed bids', () => {
    expect(scoreRound({ bid: 0, tricks: 0 })).toBe(20);
    expect(scoreRound({ bid: 3, tricks: 3 })).toBe(50);
    expect(scoreRound({ bid: 3, tricks: 1 })).toBe(-20);
  });
});
