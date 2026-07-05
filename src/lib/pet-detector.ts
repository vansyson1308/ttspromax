/**
 * Pet mouth detection using COCO-SSD.
 *
 * Detects cat/dog bounding box, estimates mouth position at lower-center.
 * Falls back to center-bottom if no pet detected or confidence too low.
 *
 * The full bbox is also returned so downstream consumers (auto-framing,
 * eye-blink overlays, body animator) can derive their own positions.
 */

import type { MouthRegion } from "./mouth-renderer";
import { logger } from "./logger";

/** Minimum confidence required to trust a detection result. */
const MIN_CONFIDENCE = 0.4;

const log = logger.child("PetDetector");

// COCO-SSD model singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelPromise: Promise<any> | null = null;

async function getModel() {
  if (!modelPromise) {
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    modelPromise = cocoSsd.load({ base: "lite_mobilenet_v2" });
  }
  return modelPromise;
}

/** Pet bounding box in normalised canvas coordinates [0..1]. */
export interface PetBBox {
  x: number;      // top-left x
  y: number;      // top-left y
  w: number;      // width
  h: number;      // height
  cx: number;     // centre x
  cy: number;     // centre y
}

export interface DetectionResult {
  detected: boolean;
  petClass: string | null; // "cat" or "dog"
  mouthRegion: MouthRegion;
  bbox: PetBBox | null;
  confidence: number;
}

/**
 * Detect pet in image and estimate mouth position.
 * @param img HTMLImageElement or HTMLCanvasElement to analyze
 * @param canvasW canvas width (for normalization)
 * @param canvasH canvas height (for normalization)
 */
export async function detectPetMouth(
  img: HTMLImageElement | HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
): Promise<DetectionResult> {
  const fallback: DetectionResult = {
    detected: false,
    petClass: null,
    confidence: 0,
    bbox: null,
    mouthRegion: { x: 0.5, y: 0.75, w: 0.12, h: 0.08 },
  };

  try {
    const model = await getModel();
    const predictions = await model.detect(img);

    const pets = predictions
      .filter((p: { class: string }) => p.class === "cat" || p.class === "dog")
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    if (pets.length === 0) return fallback;

    const pet = pets[0];

    if (pet.score < MIN_CONFIDENCE) {
      log.warn(`Low confidence (${pet.score.toFixed(2)} < ${MIN_CONFIDENCE}), using fallback`);
      return fallback;
    }

    const [bx, by, bw, bh] = pet.bbox; // [x, y, width, height] in pixels

    const bboxNorm: PetBBox = {
      x: bx / canvasW,
      y: by / canvasH,
      w: bw / canvasW,
      h: bh / canvasH,
      cx: (bx + bw / 2) / canvasW,
      cy: (by + bh / 2) / canvasH,
    };

    // Estimate mouth: lower-center of bounding box (78% down, centred horizontally)
    const mouthX = (bx + bw / 2) / canvasW;
    const mouthY = (by + bh * 0.78) / canvasH;
    const mouthW = (bw * 0.25) / canvasW;
    const mouthH = (bh * 0.12) / canvasH;

    return {
      detected: true,
      petClass: pet.class,
      confidence: pet.score,
      bbox: bboxNorm,
      mouthRegion: {
        x: Math.max(0.05, Math.min(0.95, mouthX)),
        y: Math.max(0.05, Math.min(0.95, mouthY)),
        w: Math.max(0.05, Math.min(0.3, mouthW)),
        h: Math.max(0.03, Math.min(0.15, mouthH)),
      },
    };
  } catch (err) {
    log.warn("Detection failed:", err);
    return fallback;
  }
}
