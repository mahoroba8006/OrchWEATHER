export type ChartViewport = { start: number; end: number };
export type ChartGestureMode = 'idle' | 'pending' | 'pan' | 'pinch' | 'vertical' | 'blocked';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createViewportAround(
  total: number,
  preferredIndex: number,
  requestedWindow: number,
): ChartViewport | null {
  if (total <= 0) return null;
  const windowSize = clamp(Math.round(requestedWindow), 1, total);
  const anchor = clamp(preferredIndex, 0, total - 1);
  const start = clamp(Math.round(anchor - windowSize / 2), 0, total - windowSize);
  return { start, end: start + windowSize };
}

export function panViewport(
  viewport: ChartViewport,
  total: number,
  deltaX: number,
  plotWidth: number,
): ChartViewport {
  const windowSize = viewport.end - viewport.start;
  const shift = Math.round((-deltaX / Math.max(1, plotWidth)) * windowSize);
  const start = clamp(viewport.start + shift, 0, Math.max(0, total - windowSize));
  return { start, end: start + windowSize };
}

export function zoomViewport({
  viewport,
  total,
  initialDistance,
  currentDistance,
  anchorRatio,
  minWindow,
}: {
  viewport: ChartViewport;
  total: number;
  initialDistance: number;
  currentDistance: number;
  anchorRatio: number;
  minWindow: number;
}): ChartViewport {
  const initialWindow = viewport.end - viewport.start;
  const nextWindow = clamp(
    Math.round(initialWindow * Math.max(1, initialDistance) / Math.max(1, currentDistance)),
    Math.min(minWindow, total),
    total,
  );
  const ratio = clamp(anchorRatio, 0, 1);
  const anchorIndex = viewport.start + ratio * initialWindow;
  const start = clamp(Math.round(anchorIndex - ratio * nextWindow), 0, Math.max(0, total - nextWindow));
  return { start, end: start + nextWindow };
}

export function classifySinglePointer(
  deltaX: number,
  deltaY: number,
  threshold = 5,
): 'pending' | 'pan' | 'vertical' {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (Math.max(absX, absY) <= threshold) return 'pending';
  return absX > absY ? 'pan' : 'vertical';
}

export function horizontalPinchDistance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.abs(second.x - first.x);
}

export function nextGestureMode(
  mode: ChartGestureMode,
  pointerCount: number,
  deltaX: number,
  deltaY: number,
): ChartGestureMode {
  if (pointerCount <= 0) return 'idle';
  if (mode === 'blocked') return 'blocked';
  if (pointerCount >= 2) return 'pinch';
  if (mode === 'pinch') return 'blocked';
  if (mode === 'pan' || mode === 'vertical') return mode;
  if (mode === 'idle') return 'pending';
  return classifySinglePointer(deltaX, deltaY);
}

export function shouldAcceptChartTooltip(
  mode: ChartGestureMode,
  suppressUntil: number,
  now: number,
): boolean {
  return (mode === 'idle' || mode === 'pending') && now >= suppressUntil;
}
