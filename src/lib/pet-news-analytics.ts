/**
 * Lightweight analytics hooks for Pet News feature.
 *
 * Graceful no-op when analytics backend is absent.
 * Privacy-safe: no PII, no URLs, no raw script text.
 *
 * Tries in order:
 *  1. window.gtag (Google Analytics)
 *  2. window.dataLayer.push (Google Tag Manager)
 *  3. Custom callback (if registered)
 *  4. No-op
 */

type AnalyticsEvent =
  | "pet_news_pet_fetch_started"
  | "pet_news_pet_fetch_failed"
  | "pet_news_detection_succeeded"
  | "pet_news_detection_failed"
  | "pet_news_script_generated"
  | "pet_news_tts_started"
  | "pet_news_tts_failed"
  | "pet_news_record_started"
  | "pet_news_record_completed"
  | "pet_news_record_failed"
  | "pet_news_voice_selected"
  | "pet_news_topic_selected";

interface EventProps {
  /** Additional non-PII metadata (optional) */
  properties?: Record<string, string | number | boolean>;
}

// Custom callback registry (optional — for projects with their own analytics)
type CustomCallback = (event: AnalyticsEvent, props?: EventProps["properties"]) => void;
let customCallback: CustomCallback | null = null;

/** Register a custom analytics callback. Useful for testing or custom backends. */
export function registerAnalyticsCallback(cb: CustomCallback): void {
  customCallback = cb;
}

function hasGtag(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as Record<string, unknown>).gtag === "function";
}

function hasDataLayer(): boolean {
  return typeof window !== "undefined" && Array.isArray((window as unknown as Record<string, unknown>).dataLayer);
}

function pushGtag(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (!hasGtag()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as Record<string, any>).gtag;
  gtag("event", event, props || {});
}

function pushDataLayer(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (!hasDataLayer()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dl = (window as Record<string, any>).dataLayer;
  dl.push({ event, ...props });
}

/**
 * Fire an analytics event.
 *
 * Safe to call even if no analytics backend exists — it becomes a no-op.
 */
export function trackPetNewsEvent(event: AnalyticsEvent, options?: EventProps): void {
  try {
    pushGtag(event, options?.properties);
    pushDataLayer(event, options?.properties);
    customCallback?.(event, options?.properties);
  } catch {
    // Never crash the app due to analytics
  }
}
