import './ui.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}

/** 淡く光る骨組み表示（読み込み中の面） */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={['ui-skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
