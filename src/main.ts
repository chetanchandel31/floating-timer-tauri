import { getCurrentWindow } from "@tauri-apps/api/window";

// querySelector can return null if the element isn't found. The "!" tells
// TypeScript "trust me, it exists" (it does, we wrote the HTML).
const timeEl = document.querySelector<HTMLDivElement>("#time")!;
const toggleBtn = document.querySelector<HTMLButtonElement>("#toggle")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset")!;
const closeBtn = document.querySelector<HTMLButtonElement>("#close")!;

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

function render(): void {
  timeEl.textContent = format(elapsedMs());
  if (startedAt !== null) {
    toggleBtn.textContent = "Pause";
  } else {
    toggleBtn.textContent = accumulatedMs > 0 ? "Resume" : "Start";
  }
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
