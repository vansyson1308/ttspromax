/**
 * Viseme-to-canvas mouth renderer for Pet News Network.
 *
 * Maps HeadAudio's 15 Oculus viseme values → composite mouth shape → canvas drawing.
 * Cartoonish style: dark ellipse opening + lip outlines + optional teeth/tongue.
 */

export interface MouthRegion {
  x: number; // center X (0-1 normalized)
  y: number; // center Y (0-1 normalized)
  w: number; // width (0-1 normalized)
  h: number; // height (0-1 normalized)
}

export interface VisemeState {
  [key: string]: number;
}

interface MouthShape {
  openness: number;  // 0-1 vertical opening
  width: number;     // 0-1 horizontal stretch
  roundness: number; // 0-1 how round
  lipTuck: number;   // 0-1 lips pressed together
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function computeMouthShape(vs: VisemeState): MouthShape {
  const aa = vs.viseme_aa || 0;
  const E = vs.viseme_E || 0;
  const I = vs.viseme_I || 0;
  const O = vs.viseme_O || 0;
  const U = vs.viseme_U || 0;
  const PP = vs.viseme_PP || 0;
  const FF = vs.viseme_FF || 0;
  const DD = vs.viseme_DD || 0;
  const CH = vs.viseme_CH || 0;

  return {
    openness: clamp(Math.max(aa, E * 0.7, O * 0.8, DD * 0.5, CH * 0.6)),
    width: clamp(Math.max(aa * 0.8, E * 0.9, I, CH * 0.7) - Math.max(O * 0.5, U * 0.7)),
    roundness: clamp(Math.max(O, U * 0.9) - Math.max(I * 0.3, E * 0.2)),
    lipTuck: clamp(Math.max(PP, FF * 0.8)),
  };
}

export function drawMouth(
  ctx: CanvasRenderingContext2D,
  region: MouthRegion,
  canvasW: number,
  canvasH: number,
  shape: MouthShape
): void {
  const cx = region.x * canvasW;
  const cy = region.y * canvasH;
  const rw = (region.w * canvasW) / 2;
  const rh = (region.h * canvasH) / 2;

  // If lips are tucked (PP, FF), draw a thin line
  if (shape.lipTuck > 0.5) {
    const lineW = rw * (0.4 + shape.lipTuck * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx - lineW, cy);
    ctx.lineTo(cx + lineW, cy);
    ctx.strokeStyle = "#4a1a1a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    return;
  }

  // If mouth barely open, draw small curve
  if (shape.openness < 0.05) {
    const smileW = rw * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - smileW, cy);
    ctx.quadraticCurveTo(cx, cy + 4, cx + smileW, cy);
    ctx.strokeStyle = "#4a1a1a";
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  // Mouth opening
  const mouthW = rw * (0.3 + shape.width * 0.5 + (1 - shape.roundness) * 0.2);
  const mouthH = rh * (0.15 + shape.openness * 0.85);

  // Dark mouth interior
  ctx.beginPath();
  ctx.ellipse(cx, cy, mouthW, mouthH, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(mouthW, mouthH));
  grad.addColorStop(0, "#2a0505");
  grad.addColorStop(1, "#5a1515");
  ctx.fillStyle = grad;
  ctx.fill();

  // Teeth (top)
  if (shape.openness > 0.2) {
    const teethW = mouthW * 0.7;
    const teethH = mouthH * 0.25;
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(cx - teethW, cy - mouthH, teethW * 2, teethH);
  }

  // Tongue (when open)
  if (shape.openness > 0.4) {
    const tongueW = mouthW * 0.5;
    const tongueH = mouthH * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, cy + mouthH * 0.4, tongueW, tongueH, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e06060";
    ctx.fill();
  }

  // Lip outline
  ctx.beginPath();
  ctx.ellipse(cx, cy, mouthW + 2, mouthH + 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#6a2020";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}
