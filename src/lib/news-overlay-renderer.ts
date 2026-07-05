/**
 * Canvas renderer for the news-broadcast overlay (lower-third + ticker + logo).
 *
 * The overlay draws into the same canvas the rest of Pet News uses, so it's
 * captured by the MediaRecorder automatically without needing html2canvas.
 *
 * Each frame the caller passes the current ticker text, channel name, and an
 * advancing pixel offset for the scroll. Optional channel emoji is drawn in
 * the top-right.
 */

export interface NewsOverlayState {
  channelName: string;
  liveStrap: string;
  tickerText: string;
  /** Pixel offset for ticker scroll. Increment ~80 px/sec. */
  tickerOffsetPx: number;
  /** Show the lower-third banner. */
  showLowerThird: boolean;
  /** Show the scrolling ticker bar. */
  showTicker: boolean;
  /** Show the channel logo in the top-right corner. */
  showLogo: boolean;
  /** Optional emoji rendered as the channel logo. */
  logoEmoji?: string;
}

const TICKER_HEIGHT = 36;
const LOWER_THIRD_HEIGHT = 72;
const LOGO_PADDING = 14;

export function defaultOverlayState(): NewsOverlayState {
  return {
    channelName: "PET NEWS",
    liveStrap: "LIVE",
    tickerText: "",
    tickerOffsetPx: 0,
    showLowerThird: true,
    showTicker: true,
    showLogo: true,
    logoEmoji: "📺",
  };
}

/**
 * Draw the broadcast background — a subtle radial gradient that frames the pet.
 * Render this BEFORE drawing the pet image.
 */
export function drawBroadcastBackground(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  timeSec: number,
): void {
  // Slow hue drift in HSL — keeps the background alive without being noisy.
  const hue1 = 235 + Math.sin(timeSec * 0.15) * 12;
  const hue2 = 290 + Math.cos(timeSec * 0.1) * 14;

  const grad = ctx.createRadialGradient(
    canvasW / 2, canvasH * 0.55, canvasW * 0.1,
    canvasW / 2, canvasH * 0.55, Math.max(canvasW, canvasH) * 0.8,
  );
  grad.addColorStop(0, `hsl(${hue1}, 55%, 22%)`);
  grad.addColorStop(0.7, `hsl(${hue2}, 60%, 8%)`);
  grad.addColorStop(1, "#000");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

/**
 * Draw all enabled overlay elements. Call AFTER drawing pet + mouth + particles
 * so the broadcast UI sits on top.
 */
export function drawNewsOverlay(
  ctx: CanvasRenderingContext2D,
  state: NewsOverlayState,
  canvasW: number,
  canvasH: number,
  timeSec: number,
): void {
  if (state.showLogo) drawLogo(ctx, state, canvasW);
  if (state.showLowerThird) drawLowerThird(ctx, state, canvasW, canvasH, timeSec);
  if (state.showTicker) drawTicker(ctx, state, canvasW, canvasH);
}

function drawLogo(ctx: CanvasRenderingContext2D, state: NewsOverlayState, canvasW: number): void {
  const radius = 28;
  const cx = canvasW - LOGO_PADDING - radius;
  const cy = LOGO_PADDING + radius;

  ctx.save();
  // Drop shadow circle
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(cx + 1.5, cy + 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // Logo background
  ctx.fillStyle = "#0b1736";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Accent ring
  ctx.strokeStyle = "#ff4757";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
  ctx.stroke();

  // Emoji
  ctx.fillStyle = "#fff";
  ctx.font = `${radius * 1.1}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.logoEmoji ?? "📺", cx, cy + 2);
  ctx.restore();
}

function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  state: NewsOverlayState,
  canvasW: number,
  canvasH: number,
  timeSec: number,
): void {
  const ltY = canvasH - TICKER_HEIGHT - LOWER_THIRD_HEIGHT - 4;
  const padding = 24;

  ctx.save();
  // Banner background — gradient + subtle shadow
  const grad = ctx.createLinearGradient(0, ltY, 0, ltY + LOWER_THIRD_HEIGHT);
  grad.addColorStop(0, "rgba(11,23,54,0.92)");
  grad.addColorStop(1, "rgba(11,23,54,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, ltY, canvasW, LOWER_THIRD_HEIGHT);

  // Red accent bar on the left
  ctx.fillStyle = "#ff4757";
  ctx.fillRect(0, ltY, 6, LOWER_THIRD_HEIGHT);

  // LIVE badge
  const pulse = (Math.sin(timeSec * 5) + 1) / 2; // 0..1
  ctx.fillStyle = "#ff4757";
  const badgeX = padding;
  const badgeY = ltY + 12;
  const badgeH = 22;
  ctx.fillRect(badgeX, badgeY, 60, badgeH);
  // Pulsing dot
  ctx.fillStyle = `rgba(255,255,255,${0.5 + pulse * 0.5})`;
  ctx.beginPath();
  ctx.arc(badgeX + 12, badgeY + badgeH / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui,-apple-system,Segoe UI,sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("LIVE", badgeX + 22, badgeY + badgeH / 2 + 1);

  // Channel name
  ctx.fillStyle = "#fff";
  ctx.font = "900 22px system-ui,-apple-system,Segoe UI,sans-serif";
  ctx.fillText(state.channelName, padding, ltY + 50);

  // Strap line (separator + LIVE strap)
  const cnWidth = ctx.measureText(state.channelName).width;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 13px system-ui,-apple-system,Segoe UI,sans-serif";
  ctx.fillText(`  •  ${state.liveStrap}`, padding + cnWidth, ltY + 50);

  ctx.restore();
}

function drawTicker(
  ctx: CanvasRenderingContext2D,
  state: NewsOverlayState,
  canvasW: number,
  canvasH: number,
): void {
  if (!state.tickerText) return;
  const ty = canvasH - TICKER_HEIGHT;

  ctx.save();
  // Background
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, ty, canvasW, TICKER_HEIGHT);
  // Top accent
  ctx.fillStyle = "#ff4757";
  ctx.fillRect(0, ty, canvasW, 2);

  // Label box on the left ("BREAKING")
  const labelW = 110;
  ctx.fillStyle = "#ff4757";
  ctx.fillRect(0, ty + 2, labelW, TICKER_HEIGHT - 2);
  ctx.fillStyle = "#fff";
  ctx.font = "900 13px system-ui,-apple-system,Segoe UI,sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("BREAKING", labelW / 2, ty + TICKER_HEIGHT / 2 + 1);

  // Scrolling text — clip to area right of label
  ctx.beginPath();
  ctx.rect(labelW, ty, canvasW - labelW, TICKER_HEIGHT);
  ctx.clip();

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "600 15px system-ui,-apple-system,Segoe UI,sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const textWidth = ctx.measureText(state.tickerText).width;
  // Modulo so the offset wraps cleanly even after long playback.
  const offset = state.tickerOffsetPx % textWidth;
  // Draw the string twice end-to-end to fake an infinite scroll.
  const startX = labelW + 16 - offset;
  ctx.fillText(state.tickerText, startX, ty + TICKER_HEIGHT / 2 + 1);
  ctx.fillText(state.tickerText, startX + textWidth, ty + TICKER_HEIGHT / 2 + 1);

  ctx.restore();
}
