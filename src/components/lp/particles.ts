// LP 背景の舞うもの（花びら・光の粒・落ち葉・雪）。少なく、ゆっくり（試作 v2 の設定）。
import type { Weights } from '../../lib/lpScene';

export type ParticleKind = 'petal' | 'light' | 'leaf' | 'snow';
const KINDS: readonly ParticleKind[] = ['petal', 'light', 'leaf', 'snow'];

export interface Particle {
  x: number;
  y: number;
  /** 落下の速さ */
  v: number;
  /** 揺れと回転の角度 */
  a: number;
  /** 大きさの倍率 */
  s: number;
  /** 種類を決める粒ごとの固定の乱数 */
  k: number;
}

export function createParticles(n: number, w: number, h: number, rand: () => number = Math.random): Particle[] {
  return Array.from({ length: n }, () => ({
    x: rand() * w,
    y: rand() * h,
    v: 0.18 + rand() * 0.32,
    a: rand() * Math.PI * 2,
    s: 0.6 + rand() * 0.8,
    k: rand(),
  }));
}

/** 粒の乱数 k と季節の割合から種類を決める（割合が全部 0 なら null＝描かない） */
export function kindFor(k: number, w: Weights): ParticleKind | null {
  const sum = w[0] + w[1] + w[2] + w[3];
  if (sum <= 0) return null;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += w[i] / sum;
    if (k < acc) return KINDS[i];
  }
  return KINDS[3];
}

export function stepParticle(q: Particle, kind: ParticleKind, w: number, h: number, rand: () => number = Math.random): void {
  q.a += 0.008;
  if (kind === 'light') {
    q.y -= q.v * 0.25;
    q.x += Math.sin(q.a) * 0.3;
  } else {
    q.y += q.v * (kind === 'snow' ? 0.7 : 1);
    q.x += Math.sin(q.a) * 0.45 + (kind === 'leaf' ? 0.25 : 0.12);
  }
  if (q.y > h + 20) {
    q.y = -20;
    q.x = rand() * w;
  }
  if (q.y < -20) q.y = h + 10;
  if (q.x > w + 20) q.x = -20;
}

export function drawParticle(ctx: CanvasRenderingContext2D, q: Particle, kind: ParticleKind): void {
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.rotate(q.a);
  ctx.beginPath();
  if (kind === 'petal') {
    ctx.fillStyle = 'rgba(250, 205, 215, 0.9)';
    ctx.ellipse(0, 0, 5 * q.s, 3 * q.s, 0, 0, Math.PI * 2);
  } else if (kind === 'light') {
    ctx.fillStyle = `rgba(255, 255, 230, ${0.25 + 0.25 * Math.sin(q.a * 3)})`;
    ctx.arc(0, 0, 1.6 * q.s, 0, Math.PI * 2);
  } else if (kind === 'leaf') {
    ctx.fillStyle = q.k > 0.5 ? 'rgba(214, 110, 48, 0.9)' : 'rgba(232, 170, 60, 0.9)';
    ctx.ellipse(0, 0, 6 * q.s, 3 * q.s, 0, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.arc(0, 0, 2.2 * q.s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

export const particleCount = (width: number) => (width < 600 ? 16 : 26);
