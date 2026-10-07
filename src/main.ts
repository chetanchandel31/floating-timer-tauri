import { getCurrentWindow } from "@tauri-apps/api/window";

// querySelector can return null if the element isn't found. The "!" tells
// TypeScript "trust me, it exists" (it does, we wrote the HTML).
const timeEl = document.querySelector<HTMLDivElement>("#time")!;
const toggleBtn = document.querySelector<HTMLButtonElement>("#toggle")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset")!;
const closeBtn = document.querySelector<HTMLButtonElement>("#close")!;
const dotEl = document.querySelector<HTMLSpanElement>("#dot")!;

// Time banked from earlier running periods (ms)
let accumulatedMs = 0;
// performance.now() reading when the current run began, or null if paused
let startedAt: number | null = null;
let intervalId: number | undefined;

function elapsedMs(): number {
  return (
    accumulatedMs + (startedAt === null ? 0 : performance.now() - startedAt)
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// The overlay badge is a Windows-only feature, so skip it elsewhere
const isWindows = navigator.userAgent.includes("Windows");
let badgePng: Uint8Array | null = null;
let lastBadgeRunning: boolean | null = null;

// Draw a green dot with a white ring on a canvas and encode it as PNG,
// so there's no image file to ship.
async function makeBadge(): Promise<Uint8Array> {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = "#3ddc84";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff"; // ring keeps it visible on any taskbar color
  ctx.stroke();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

// Only touches the taskbar when the running state actually changes
async function updateBadge(running: boolean): Promise<void> {
  if (!isWindows || running === lastBadgeRunning) return;
  lastBadgeRunning = running;
  try {
    const win = getCurrentWindow();
    if (running) {
      badgePng ??= await makeBadge();
      await win.setOverlayIcon(badgePng);
    } else {
      await win.setOverlayIcon(undefined); // removes the badge
    }
  } catch (e) {
    console.error("overlay icon failed", e);
  }
}

function render(): void {
  const running = startedAt !== null;

  const t = format(elapsedMs());
  if (timeEl.textContent !== t) timeEl.textContent = t;

  const label = running ? "Pause" : accumulatedMs > 0 ? "Resume" : "Start";
  if (toggleBtn.textContent !== label) toggleBtn.textContent = label;

  const state = running ? "running" : "idle";
  if (toggleBtn.dataset.state !== state) toggleBtn.dataset.state = state;

  dotEl.classList.toggle("running", running);
  void updateBadge(running);
}

function start(): void {
  startedAt = performance.now();
  // The interval only triggers redraws. The elapsed time itself always
  // comes from performance.now(), so throttling can't make it drift.
  intervalId = window.setInterval(render, 100);
  render();
}

function pause(): void {
  accumulatedMs = elapsedMs();
  startedAt = null;
  window.clearInterval(intervalId);
  render();
}

function toggle(): void {
  if (startedAt === null) {
    start();
  } else {
    pause();
  }
}

function reset(): void {
  startedAt = null;
  accumulatedMs = 0;
  window.clearInterval(intervalId);
  render();
}

toggleBtn.addEventListener("click", toggle);
resetBtn.addEventListener("click", reset);
closeBtn.addEventListener("click", () => {
  getCurrentWindow().close();
});

// Clicking a button must not give it keyboard focus. Otherwise Enter or
// Space would also "click" the focused button.
for (const btn of [toggleBtn, resetBtn, closeBtn]) {
  btn.addEventListener("mousedown", (e) => e.preventDefault());
}

// The only keyboard shortcut: Enter toggles pause/resume.
window.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (!e.repeat) toggle(); // ignore auto-repeat while the key is held
});

render();
