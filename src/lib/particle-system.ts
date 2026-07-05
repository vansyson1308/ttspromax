/**
 * Tiny canvas particle system for Pet News reactions.
 *
 * Three particle styles:
 *   - sparkle (small white star)
 *   - heart (pink heart)
 *   - confetti (rectangle that tumbles)
 *
 * Usage:
 *   const particles = new ParticleSystem();
 *   particles.spawnFromAmplitude(amp, sourceX, sourceY);
 *   particles.update(dtMs);
 *   particles.draw(ctx);
 *
 * Performance budget: capped at MAX_PARTICLES, sparse rendering.
 */

const MAX_PARTICLES = 80;
const GRAVITY = 0.00012; // px / ms²

export type ParticleKind = "sparkle" | "heart" | "confetti";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  ageMs: number;
  lifeMs: number;
  color: string;
}

const HEART_COLORS = ["#ff4d8d", "#ff6f9c", "#ffb3c6"];
const CONFETTI_COLORS = ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#a06cd5"];

export class ParticleSystem {
  private particles: Particle[] = [];
  /** Throttle spawn rate based on amplitude. */
  private spawnAccumulator = 0;

  /** Number of live particles. */
  get size(): number {
    return this.particles.length;
  }

  /** Throw a small handful of particles when amplitude crosses a threshold. */
  spawnFromAmplitude(amplitude: number, sourceX: number, sourceY: number, dtMs: number): void {
    // Each amplitude unit produces ~6 particles per second.
    this.spawnAccumulator += amplitude * dtMs * 0.006;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawn(pickKindFromAmplitude(amplitude), sourceX, sourceY);
    }
  }

  /** Confetti burst — used when audio ends. */
  burstConfetti(centerX: number, centerY: number, count = 40): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.18 + Math.random() * 0.32;
      this.particles.push({
        kind: "confetti",
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.25,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.02,
        size: 6 + Math.random() * 5,
        ageMs: 0,
        lifeMs: 1800 + Math.random() * 800,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      });
    }
  }

  /** Step physics. */
  update(dtMs: number): void {
    for (const p of this.particles) {
      p.ageMs += dtMs;
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.vy += GRAVITY * dtMs;
      p.rot += p.vrot * dtMs;
    }
    // Reap expired
    if (this.particles.length > 0) {
      this.particles = this.particles.filter((p) => p.ageMs < p.lifeMs);
    }
  }

  /** Draw all particles to ctx. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      const lifeFrac = p.ageMs / p.lifeMs;
      const alpha = lifeFrac < 0.85 ? 1 : 1 - (lifeFrac - 0.85) / 0.15;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      switch (p.kind) {
        case "sparkle": drawSparkle(ctx, p.size, p.color); break;
        case "heart": drawHeart(ctx, p.size, p.color); break;
        case "confetti": drawConfettiRect(ctx, p.size, p.color); break;
      }
      ctx.restore();
    }
  }

  /** Drop everything (e.g. when changing pet image). */
  clear(): void {
    this.particles.length = 0;
    this.spawnAccumulator = 0;
  }

  private spawn(kind: ParticleKind, sourceX: number, sourceY: number): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const speed = 0.08 + Math.random() * 0.16;
    const sizeBase = kind === "heart" ? 11 : kind === "confetti" ? 6 : 4;
    this.particles.push({
      kind,
      x: sourceX + (Math.random() - 0.5) * 30,
      y: sourceY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.01,
      size: sizeBase + Math.random() * 4,
      ageMs: 0,
      lifeMs: kind === "confetti" ? 1500 : 1100,
      color:
        kind === "heart"
          ? HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)]
          : kind === "confetti"
          ? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
          : "rgba(255,255,255,1)",
    });
  }
}

function pickKindFromAmplitude(amp: number): ParticleKind {
  // Louder peaks more often produce hearts; soft speech gets sparkles.
  if (amp > 0.55) return Math.random() < 0.6 ? "heart" : "sparkle";
  if (amp > 0.35) return Math.random() < 0.3 ? "heart" : "sparkle";
  return "sparkle";
}

function drawSparkle(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  // 4-pointed star using two crossed quads
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.3, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(0, size * 0.3);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, -size * 0.3);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  // Classic heart path scaled by size.
  const s = size / 11;
  ctx.moveTo(0, 4 * s);
  ctx.bezierCurveTo(0, -2 * s, -10 * s, -2 * s, -10 * s, 4 * s);
  ctx.bezierCurveTo(-10 * s, 8 * s, -5 * s, 11 * s, 0, 14 * s);
  ctx.bezierCurveTo(5 * s, 11 * s, 10 * s, 8 * s, 10 * s, 4 * s);
  ctx.bezierCurveTo(10 * s, -2 * s, 0, -2 * s, 0, 4 * s);
  ctx.fill();
}

function drawConfettiRect(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 4, size, size / 2);
}
