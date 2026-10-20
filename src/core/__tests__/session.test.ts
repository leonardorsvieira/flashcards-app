import { addDays, endOfDay, MINUTE_MS } from '../dates';
import { scheduleReview } from '../scheduler';
import { advanceQueue, buildDeckStudyQueue, buildStudyQueue } from '../session';
import { at, makeCard, makeReview } from '../__fixtures__/helpers';

const NOW = at(2026, 5, 15, 10);

function review(dueAt: number, intervalDays = 5) {
  return makeCard({ schedule: { dueAt, intervalDays, repetitions: 2, lastReviewedAt: dueAt - 5 * 86400000 } });
}

describe('buildStudyQueue', () => {
  it('separates learning, due reviews and new cards and skips future cards', () => {
    const overdue = review(addDays(NOW, -3));
    const dueNow = review(NOW - 1000);
    const laterToday = review(NOW + 3 * 60 * MINUTE_MS);
    const tomorrow = review(addDays(NOW, 1));
    const learning = makeCard({ schedule: { dueAt: NOW + 5 * MINUTE_MS, repetitions: 0 } });
    const fresh = makeCard();

    const q = buildStudyQueue([fresh, tomorrow, laterToday, dueNow, learning, overdue], {
      now: NOW,
      newLimit: 10,
      reviewLimit: 10,
    });
    expect(q.learning.map((c) => c.id)).toEqual([learning.id]);
    expect(q.reviews.map((c) => c.id)).toEqual([overdue.id, dueNow.id, laterToday.id]);
    expect(q.newCards.map((c) => c.id)).toEqual([fresh.id]);
    expect(q.cards.map((c) => c.id)).toEqual([learning.id, overdue.id, dueNow.id, laterToday.id, fresh.id]);
  });

  it("dueCutoff 'now' excludes cards due later today", () => {
    const laterToday = review(NOW + 60 * MINUTE_MS);
    const q = buildStudyQueue([laterToday], { now: NOW, newLimit: 0, reviewLimit: 10, dueCutoff: 'now' });
    expect(q.cards).toEqual([]);
  });

  it('applies new and review limits, minus what was already done today', () => {
    const reviews = Array.from({ length: 8 }, (_, i) => review(addDays(NOW, -i - 1)));
    const news = Array.from({ length: 8 }, () => makeCard());
    const q = buildStudyQueue([...news, ...reviews], {
      now: NOW,
      newLimit: 5,
      reviewLimit: 6,
      newSeenToday: 2,
      reviewsDoneToday: 1,
    });
    expect(q.newCards).toHaveLength(3);
    expect(q.newCards.map((c) => c.id)).toEqual(news.slice(0, 3).map((c) => c.id));
    expect(q.reviews).toHaveLength(5);
    expect(q.reviews[0].id).toBe(reviews[7].id); // most overdue first
    expect(q.newAvailable).toBe(8);
    expect(q.reviewsAvailable).toBe(8);
  });

  it('never goes negative when limits are already exceeded', () => {
    const q = buildStudyQueue([makeCard(), review(NOW - 1)], {
      now: NOW,
      newLimit: 1,
      reviewLimit: 1,
      newSeenToday: 5,
      reviewsDoneToday: 5,
    });
    expect(q.cards).toEqual([]);
  });

  it('supports new-card ordering before and interleaved', () => {
    const reviews = Array.from({ length: 4 }, (_, i) => review(NOW - (i + 1) * 1000));
    const news = Array.from({ length: 2 }, () => makeCard());
    const base = { now: NOW, newLimit: 10, reviewLimit: 10 };

    const before = buildStudyQueue([...reviews, ...news], { ...base, newCardOrder: 'before' });
    expect(before.cards.slice(0, 2).map((c) => c.id)).toEqual(news.map((c) => c.id));

    const mixed = buildStudyQueue([...reviews, ...news], { ...base, newCardOrder: 'interleave' });
    expect(mixed.cards).toHaveLength(6);
    const positions = news.map((n) => mixed.cards.findIndex((c) => c.id === n.id));
    expect(positions).toEqual([2, 5]);
    expect(new Set(mixed.cards.map((c) => c.id)).size).toBe(6);
  });
});

describe('buildDeckStudyQueue', () => {
  it("uses the deck's limits and today's review log", () => {
    const deck = { id: 'deck-1', newCardsPerDay: 3, reviewsPerDay: 2 };
    const news = Array.from({ length: 5 }, () => makeCard());
    const dues = Array.from({ length: 4 }, () => review(NOW - 1000));
    const otherDeck = makeCard({ deckId: 'deck-2' });
    const log = [
      // one card introduced today
      makeReview({ cardId: 'intro', prevRepetitions: 0, reviewedAt: NOW - 60 * MINUTE_MS }),
      // one review of a learned card today
      makeReview({ cardId: 'old', prevRepetitions: 3, reviewedAt: NOW - 30 * MINUTE_MS }),
      makeReview({ cardId: 'old', prevRepetitions: 2, reviewedAt: addDays(NOW, -10) }),
      // other deck activity is ignored
      makeReview({ cardId: 'z', deckId: 'deck-2', prevRepetitions: 0, reviewedAt: NOW - 1000 }),
    ];
    const q = buildDeckStudyQueue(deck, [...news, ...dues, otherDeck], log, NOW);
    expect(q.newCards).toHaveLength(2);
    expect(q.reviews).toHaveLength(1);
    expect(q.cards.some((c) => c.deckId === 'deck-2')).toBe(false);
  });
});

describe('advanceQueue', () => {
  it('drops a passed card and requeues a failed one at the end', () => {
    const [a, b, c] = [makeCard(), makeCard(), makeCard()];
    const cutoff = endOfDay(NOW);

    const passed = { ...a, schedule: scheduleReview(a.schedule, 'good', NOW) };
    expect(advanceQueue([a, b, c], passed, cutoff).map((x) => x.id)).toEqual([b.id, c.id]);

    const failed = { ...a, schedule: scheduleReview(a.schedule, 'again', NOW) };
    const next = advanceQueue([a, b, c], failed, cutoff);
    expect(next.map((x) => x.id)).toEqual([b.id, c.id, a.id]);
    expect(next[2].schedule.repetitions).toBe(0);
  });
});
