/**
 * Smart pet framing — compute the cover-style transform that places the
 * detected pet face roughly at the rule-of-thirds upper-third with a comfortable
 * margin around it. Falls back to "fit centred" when no pet is detected.
 *
 * Output is a transform applied to the original photo:
 *   ctx.translate(panX, panY); ctx.scale(zoom, zoom); drawImage(...)
 */

import type { PetBBox } from "./pet-detector";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface PetFraming {
  /** Source-image area drawn (after zoom). Used by the canvas drawImage call. */
  zoom: number;
  /** Pixel offset applied AFTER fit-centring the unzoomed image. */
  panX: number;
  panY: number;
  /** True when an actual pet detection drove the framing. */
  framed: boolean;
  /** Where the pet's head ended up in canvas coordinates (normalised). */
  headCanvas: { x: number; y: number; w: number; h: number };
}

/** Compute fit-cover-centred draw rectangle for an image inside a canvas. */
function fitCentred(img: ImageDimensions, canvasW: number, canvasH: number) {
  const scale = Math.min(canvasW / img.width, canvasH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  return {
    drawW,
    drawH,
    drawX: (canvasW - drawW) / 2,
    drawY: (canvasH - drawH) / 2,
    scale,
  };
}

export interface FramingOptions {
  /** Target fraction of canvas height the pet should occupy (default 0.7). */
  targetPetHeightRatio?: number;
  /** Vertical position [0..1] for pet centre — 0.45 = upper-third (default 0.45). */
  targetCentreY?: number;
  /** Maximum zoom multiplier (default 2.0 — too much zoom looks pixelated). */
  maxZoom?: number;
}

/**
 * Decide how to crop/pan the image so the pet sits centred and prominently.
 *
 * The canvas itself doesn't change — we return numbers that the caller
 * applies via `ctx.translate(panX, panY); ctx.scale(zoom, zoom)`.
 */
export function computePetFraming(
  img: ImageDimensions,
  bbox: PetBBox | null,
  canvasW: number,
  canvasH: number,
  opts: FramingOptions = {},
): PetFraming {
  const targetPetHeight = (opts.targetPetHeightRatio ?? 0.7) * canvasH;
  const targetCentreYPx = (opts.targetCentreY ?? 0.45) * canvasH;
  const maxZoom = opts.maxZoom ?? 2.0;

  // No detection → fall back to fit-centred, no zoom.
  if (!bbox) {
    return {
      zoom: 1,
      panX: 0,
      panY: 0,
      framed: false,
      headCanvas: { x: 0.5, y: 0.5, w: 0.6, h: 0.6 },
    };
  }

  // Pet bbox in canvas coordinates BEFORE zoom (mapped from normalised).
  // bbox uses canvas-relative normalisation, so multiply by canvas dims directly.
  const petCanvasH = bbox.h * canvasH;
  const petCanvasCx = bbox.cx * canvasW;
  const petCanvasCy = bbox.cy * canvasH;

  // Choose zoom so pet height ~ target. Cap at maxZoom so we don't blow up small pets.
  const desiredZoom = targetPetHeight / Math.max(petCanvasH, 1);
  const zoom = Math.max(1, Math.min(maxZoom, desiredZoom));

  // After zooming around (canvasW/2, canvasH/2), the pet centre moves.
  // We want to translate so the pet centre lands at (canvasW/2, targetCentreYPx).
  // Translation in canvas px:
  //   newCx = canvasW/2 + (petCanvasCx - canvasW/2) * zoom + panX
  //   newCy = canvasH/2 + (petCanvasCy - canvasH/2) * zoom + panY
  const projectedCx = canvasW / 2 + (petCanvasCx - canvasW / 2) * zoom;
  const projectedCy = canvasH / 2 + (petCanvasCy - canvasH / 2) * zoom;

  let panX = canvasW / 2 - projectedCx;
  let panY = targetCentreYPx - projectedCy;

  // Clamp pan so we don't reveal big black borders. Maximum drift = (zoom-1) * dim/2.
  const maxPanX = ((zoom - 1) * canvasW) / 2;
  const maxPanY = ((zoom - 1) * canvasH) / 2;
  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));

  // Where the pet head ends up in canvas-normalised coords (after framing).
  const finalCx = (projectedCx + panX) / canvasW;
  const finalCy = (projectedCy + panY) / canvasH;

  return {
    zoom,
    panX,
    panY,
    framed: true,
    headCanvas: {
      x: finalCx,
      y: finalCy,
      w: bbox.w * zoom,
      h: bbox.h * zoom,
    },
  };
}

/**
 * Re-project a normalised point on the original photo into canvas coords
 * AFTER the framing transform has been applied. Used for placing mouth /
 * eye / particle anchors that were derived from the un-framed bbox.
 */
export function reprojectNorm(
  pointNorm: { x: number; y: number },
  framing: PetFraming,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const px = pointNorm.x * canvasW;
  const py = pointNorm.y * canvasH;
  const projectedX = canvasW / 2 + (px - canvasW / 2) * framing.zoom + framing.panX;
  const projectedY = canvasH / 2 + (py - canvasH / 2) * framing.zoom + framing.panY;
  return { x: projectedX / canvasW, y: projectedY / canvasH };
}

/**
 * Apply the framing transform to a 2D context, then call `draw` to render
 * the photo at its normal fit-centred coordinates. The save/restore is owned
 * by this helper so the caller's transform stack is unaffected.
 */
export function withFraming(
  ctx: CanvasRenderingContext2D,
  framing: PetFraming,
  canvasW: number,
  canvasH: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.scale(framing.zoom, framing.zoom);
  ctx.translate(-canvasW / 2 + framing.panX / framing.zoom, -canvasH / 2 + framing.panY / framing.zoom);
  draw();
  ctx.restore();
}

export { fitCentred };
