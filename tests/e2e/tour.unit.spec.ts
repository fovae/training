import { expect, test } from '@playwright/test';
import {
  TOUR_VERSION,
  autoplays,
  closeTour,
  isLast,
  nextSlide,
  pauseTour,
  prevSlide,
  resumeTour,
  shouldShowTour,
  startTour,
} from '../../src/lib/tour';

/** Тур (3.24, src/lib/tour.ts): листание, пауза, автопереход как в историях, условия показа */

test('next / back stay within bounds; back turns autoplay off for good, next does not', () => {
  let s = startTour(5);
  expect(autoplays(s)).toBe(true);
  s = nextSlide(nextSlide(s));
  expect(s.i).toBe(2);
  expect(s.auto).toBe(true);
  s = prevSlide(s);
  expect(s.i).toBe(1);
  expect(s.auto).toBe(false);
  expect(autoplays(s)).toBe(false);
  s = nextSlide(s);
  expect(s.auto).toBe(false);
  expect(prevSlide(prevSlide(prevSlide(s))).i).toBe(0);
  // на последнем «вперёд» ничего не делает — ждёт «К тренировке»
  let last = startTour(5);
  for (let k = 0; k < 10; k++) last = nextSlide(last);
  expect(last.i).toBe(4);
  expect(isLast(last)).toBe(true);
  expect(last.done).toBe(false);
});

test('pause and resume; no autoplay on the last slide, when paused, or with animations off', () => {
  let s = startTour(3);
  s = pauseTour(s);
  expect(autoplays(s)).toBe(false);
  // пауза не сбрасывает автопереход
  s = resumeTour(s);
  expect(s.auto).toBe(true);
  expect(autoplays(s)).toBe(true);
  expect(autoplays(s, true)).toBe(false);
  expect(autoplays(nextSlide(nextSlide(s)))).toBe(false);
  expect(autoplays(startTour(3, false))).toBe(false);
});

test('close is idempotent; closed tour ignores input', () => {
  const c = closeTour(startTour(4));
  expect(closeTour(c)).toBe(c);
  expect(nextSlide(c)).toBe(c);
  expect(prevSlide(c)).toBe(c);
  expect(pauseTour(c)).toBe(c);
  expect(autoplays(c)).toBe(false);
});

test('shown only after onboarding, legal and install gate, until this version is seen', () => {
  const base = { hasProfile: true, legalPending: false, gateVisible: false, seen: undefined };
  expect(shouldShowTour(base)).toBe(true);
  expect(shouldShowTour({ ...base, hasProfile: false })).toBe(false);
  expect(shouldShowTour({ ...base, legalPending: true })).toBe(false);
  expect(shouldShowTour({ ...base, gateVisible: true })).toBe(false);
  expect(shouldShowTour({ ...base, seen: TOUR_VERSION })).toBe(false);
  // расширили тур — покажется снова
  expect(shouldShowTour({ ...base, seen: TOUR_VERSION - 1 })).toBe(true);
});
