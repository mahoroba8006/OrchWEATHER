import { describe, expect, it } from 'vitest';
import {
  classifySinglePointer,
  createViewportAround,
  horizontalPinchDistance,
  nextGestureMode,
  panViewport,
  shouldAcceptChartTooltip,
  zoomViewport,
} from './chartViewport';

describe('chart viewport calculations', () => {
  it('creates a window around the preferred day and clamps it to the data range', () => {
    expect(createViewportAround(365, 180, 120)).toEqual({ start: 120, end: 240 });
    expect(createViewportAround(365, 10, 120)).toEqual({ start: 0, end: 120 });
    expect(createViewportAround(60, 30, 120)).toEqual({ start: 0, end: 60 });
  });

  it('pans horizontally and stops at both ends', () => {
    const viewport = { start: 100, end: 200 };
    expect(panViewport(viewport, 365, -150, 300)).toEqual({ start: 150, end: 250 });
    expect(panViewport(viewport, 365, 900, 300)).toEqual({ start: 0, end: 100 });
    expect(panViewport(viewport, 365, -900, 300)).toEqual({ start: 265, end: 365 });
  });

  it('zooms around the pinch midpoint while preserving its anchored day', () => {
    expect(zoomViewport({
      viewport: { start: 100, end: 200 },
      total: 365,
      initialDistance: 100,
      currentDistance: 200,
      anchorRatio: 0.5,
      minWindow: 14,
    })).toEqual({ start: 125, end: 175 });
  });

  it('limits zoom to the minimum window and the full data range', () => {
    const base = {
      viewport: { start: 100, end: 200 },
      total: 365,
      anchorRatio: 0.5,
      minWindow: 14,
    };
    expect(zoomViewport({ ...base, initialDistance: 100, currentDistance: 2000 })).toEqual({ start: 143, end: 157 });
    expect(zoomViewport({ ...base, initialDistance: 100, currentDistance: 10 })).toEqual({ start: 0, end: 365 });
  });
});

describe('chart gesture arbitration', () => {
  it('keeps small movement as a tap, then separates horizontal pan from vertical scroll', () => {
    expect(classifySinglePointer(4, 2)).toBe('pending');
    expect(classifySinglePointer(8, 2)).toBe('pan');
    expect(classifySinglePointer(3, 9)).toBe('vertical');
  });

  it('accepts tooltip data only outside active or recently completed gestures', () => {
    expect(shouldAcceptChartTooltip('idle', 100, 101)).toBe(true);
    expect(shouldAcceptChartTooltip('pending', 100, 101)).toBe(true);
    expect(shouldAcceptChartTooltip('pan', 0, 101)).toBe(false);
    expect(shouldAcceptChartTooltip('pinch', 0, 101)).toBe(false);
    expect(shouldAcceptChartTooltip('idle', 200, 101)).toBe(false);
    expect(shouldAcceptChartTooltip('idle', 100, 101)).toBe(true);
  });

  it('measures pinch distance on the horizontal axis only', () => {
    expect(horizontalPinchDistance({ x: 20, y: 10 }, { x: 120, y: 10 })).toBe(100);
    expect(horizontalPinchDistance({ x: 20, y: 10 }, { x: 120, y: 210 })).toBe(100);
    expect(horizontalPinchDistance({ x: 20, y: 10 }, { x: 20, y: 210 })).toBe(0);
  });

  it('transitions tap candidates into pan, vertical scroll, and pinch modes', () => {
    expect(nextGestureMode('pending', 1, 8, 2)).toBe('pan');
    expect(nextGestureMode('pending', 1, 2, 8)).toBe('vertical');
    expect(nextGestureMode('pending', 2, 0, 0)).toBe('pinch');
    expect(nextGestureMode('pinch', 1, 0, 0)).toBe('blocked');
    expect(nextGestureMode('blocked', 0, 0, 0)).toBe('idle');
  });
});
