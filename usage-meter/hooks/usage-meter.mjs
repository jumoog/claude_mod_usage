// Usage Meter: your 5-hour and weekly plan usage, always above the prompt,
// with the time each window resets.

const WIDTH = 10;
const TICK_MS = 30_000;
const LABELS = { five_hour: "5h", seven_day: "week" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const snapshot = { plugin: "usage-meter", key: "snapshot" };

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    await refresh($);
    // Keep the countdown honest between turns.
    $.clock.every(TICK_MS, () => refresh($));
    return result;
  });

  // Fires whenever Claude Code re-measures the session, including when the
  // rate-limit headers on a response move the numbers.
  on("session.measure", async ($, e, next) => {
    const result = await next(e);
    if (Array.isArray(e.rateLimits)) {
      await save($, e.rateLimits);
    }
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) await refresh($);
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e);
    const { value } = await $.state.get(snapshot);
    const { Box, Text } = $.ui.resolve(e);
    return band(Box, Text, value, e.props.bodyColumns);
  });
}

async function refresh($) {
  const { rateLimits } = await $.session.usage();
  await save($, rateLimits ?? []);
}

async function save($, rateLimits) {
  const limits = {};
  for (const r of rateLimits) {
    if (r.kind in LABELS) {
      limits[r.kind] = { percent: clamp(r.percentUsed), resetsAt: r.resetsAt };
    }
  }
  const { value: previous } = await $.state.get(snapshot);
  // Keep the last known numbers when a measurement comes back without them.
  const merged = { ...(previous?.limits ?? {}), ...limits };
  await $.state.set(snapshot, { limits: merged, now: await $.clock.now() });
}

function band(Box, Text, value, columns) {
  const limits = value?.limits ?? {};
  // The desktop app lays the band out itself and may not pass a column count.
  const roomy = columns === undefined || columns >= 70;
  // Spelled-out resets with countdowns for both windows need about 105 columns.
  const verbose = columns === undefined || columns >= 105;

  if (!limits.five_hour && !limits.seven_day) {
    return Box({
      paddingX: 1,
      children: [Text({ dimColor: true, children: "usage: waiting for the first response…" })],
    });
  }

  const parts = [];
  for (const kind of Object.keys(LABELS)) {
    const limit = limits[kind];
    if (!limit) continue;
    if (parts.length) parts.push(Text({ dimColor: true, children: "   │  " }));
    parts.push(...meter(Text, LABELS[kind], limit.percent, roomy));
    const reset = resetText(limit.resetsAt, value.now, verbose);
    if (reset) parts.push(Text({ dimColor: true, children: reset }));
  }
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

function meter(Text, label, percent, roomy) {
  const color = percent >= 80 ? "red" : percent >= 50 ? "yellow" : "green";
  const parts = [Text({ bold: true, children: `${label} ` })];
  if (roomy) {
    const filled = Math.round((percent / 100) * WIDTH);
    if (filled > 0) parts.push(Text({ color, children: "█".repeat(filled) }));
    parts.push(Text({ dimColor: true, children: "░".repeat(WIDTH - filled) + " " }));
  }
  parts.push(Text({ color, bold: true, children: `${Math.round(percent)}%` }));
  return parts;
}

function resetText(resetsAt, now, verbose) {
  const at = Date.parse(resetsAt);
  if (!Number.isFinite(at)) return "";
  const left = at - now;
  if (left <= 0) return " · resetting…";
  const clock = when(new Date(at), new Date(now));
  return verbose ? ` · resets ${clock} (in ${duration(left)})` : ` · ↻ ${clock}`;
}

// A bare time for today; anything later also gets the weekday.
function when(d, today) {
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? hhmm(d) : `${DAYS[d.getDay()]} ${hhmm(d)}`;
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function duration(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(mins / 1440);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  if (days) return `${days}d ${h}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function clamp(n) {
  return Math.min(100, Math.max(0, Number(n) || 0));
}
