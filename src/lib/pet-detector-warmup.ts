/**
 * COCO-SSD model warmup for Pet News.
 *
 * Preloads the detection model eagerly (on first user interaction or page idle)
 * to reduce first-detection latency. Singleton-based — loads only once.
 */

import { logger } from "./logger";

let isWarming = false;
let isReady = false;

export function getModelWarmupState(): "idle" | "warming" | "ready" {
  if (isReady) return "ready";
  if (isWarming) return "warming";
  return "idle";
}

/**
 * Start warming the COCO-SSD model. Safe to call multiple times — only loads once.
 * Call this eagerly (e.g., on first user interaction) to reduce perceived latency.
 */
export async function warmupPetDetector(): Promise<void> {
  if (isReady || isWarming) return;
  isWarming = true;

  try {
    // Dynamically import TFJS + COCO-SSD — same lazy path as actual detection
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });

    // Run a trivial detection on a tiny offscreen canvas to ensure model is fully initialized
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 1, 1);
      await model.detect(canvas);
    }

    isReady = true;
  } catch (err) {
    logger.warn("[PetDetectorWarmup] Warmup failed:", err);
    // Allow retry on next call — model may still work during actual detection
    isWarming = false;
    throw err;
  }
}
