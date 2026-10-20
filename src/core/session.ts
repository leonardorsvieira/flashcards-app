import { endOfDay } from './dates';
import { studiedToday } from './stats';
import type { Card, Deck, Review } from './types';

export type NewCardOrder = 'before' | 'after' | 'interleave';

export interface StudyQueueOptions {
  now: number;
  /** Daily cap on new cards. */
  newLimit: number;
  /** Daily cap on review cards (learned cards that are due). */
  reviewLimit: number;
  /** New cards already introduced today; subtracted from newLimit. */
  newSeenToday?: number;
  /** Reviews already done today; subtracted from reviewLimit. */
  reviewsDoneToday?: number;
  /** Where new cards go relative to reviews. Default 'after'. */
  newCardOrder?: NewCardOrder;
  /**
   * 'endOfDay' (default) includes cards due any time today; 'now' only cards
   * due at or before `now`.
   */
  dueCutoff?: 'now' | 'endOfDay';
}

export interface StudyQueue {
  /** Cards in study order. */
  cards: Card[];
  /** Cards in (re)learning (graded "again"), always included, soonest first. */
  learning: Card[];
  /** Due review cards selected, most overdue first. */
  reviews: Card[];
  /** New cards selected, oldest first. */
  newCards: Card[];
  /** Due review cards available before applying the limit. */
  reviewsAvailable: number;
  /** New cards available before applying the limit. */
  newAvailable: number;
}

function interleave(reviews: Card[], newCards: Card[]): Card[] {
  if (newCards.length === 0) return [...reviews];
  if (reviews.length === 0) return [...newCards];
  const out: Card[] = [];
  const step = (reviews.length + newCards.length) / newCards.length;
  let nextNewAt = step / 2;
  let r = 0;
  let n = 0;
  for (let i = 0; i < reviews.length + newCards.length; i++) {
    if (n < newCards.length && (i >= nextNewAt || r >= reviews.length)) {
      out.push(newCards[n++]);
      nextNewAt += step;
    } else {
      out.push(reviews[r++]);
    }
  }
  return out;
}

/** Builds the ordered list of cards to study now, honoring daily limits. */
export function buildStudyQueue(cards: readonly Card[], options: StudyQueueOptions): StudyQueue {
  const cutoff = options.dueCutoff === 'now' ? options.now : endOfDay(options.now);
  const newBudget = Math.max(0, options.newLimit - (options.newSeenToday ?? 0));
  const reviewBudget = Math.max(0, options.reviewLimit - (options.reviewsDoneToday ?? 0));

  const learningAll: Card[] = [];
  const reviewAll: Card[] = [];
  const newAll: Card[] = [];
  for (const card of cards) {
    const s = card.schedule;
    if (s.dueAt === null) newAll.push(card);
    else if (s.dueAt <= cutoff) (s.repetitions === 0 ? learningAll : reviewAll).push(card);
  }

  const byDue = (a: Card, b: Card) =>
    (a.schedule.dueAt as number) - (b.schedule.dueAt as number) || a.createdAt - b.createdAt;
  learningAll.sort(byDue);
  reviewAll.sort(byDue);
  newAll.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const reviews = reviewAll.slice(0, reviewBudget);
  const newCards = newAll.slice(0, newBudget);

  let rest: Card[];
  switch (options.newCardOrder ?? 'after') {
    case 'before':
      rest = [...newCards, ...reviews];
      break;
    case 'interleave':
      rest = interleave(reviews, newCards);
      break;
    default:
      rest = [...reviews, ...newCards];
  }

  return {
    cards: [...learningAll, ...rest],
    learning: learningAll,
    reviews,
    newCards,
    reviewsAvailable: reviewAll.length,
    newAvailable: newAll.length,
  };
}

/**
 * Convenience wrapper: uses the deck's daily limits and derives how many new
 * cards / reviews were already done today from the deck's review log.
 */
export function buildDeckStudyQueue(
  deck: Pick<Deck, 'id' | 'newCardsPerDay' | 'reviewsPerDay'>,
  cards: readonly Card[],
  reviews: readonly Review[],
  now: number,
  options: Pick<StudyQueueOptions, 'newCardOrder' | 'dueCutoff'> = {},
): StudyQueue {
  const deckCards = cards.filter((c) => c.deckId === deck.id);
  const today = studiedToday(
    reviews.filter((r) => r.deckId === deck.id),
    now,
  );
  return buildStudyQueue(deckCards, {
    ...options,
    now,
    newLimit: deck.newCardsPerDay,
    reviewLimit: deck.reviewsPerDay,
    newSeenToday: today.newCards,
    reviewsDoneToday: today.reviews,
  });
}

/**
 * Updates an in-progress queue after the head card was answered: removes the
 * answered card and, if its new schedule makes it due again before `cutoff`
 * (e.g. graded "again"), re-inserts the updated card at the end.
 */
export function advanceQueue(queue: readonly Card[], answered: Card, cutoff: number): Card[] {
  const rest = queue.filter((c) => c.id !== answered.id);
  const due = answered.schedule.dueAt;
  if (due !== null && due <= cutoff) rest.push(answered);
  return rest;
}
