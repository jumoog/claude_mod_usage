import { describe, expect, test } from "claude-code/testing";

const NOW = Date.parse("2026-10-01T12:00:00Z");

function limits(hour: number, week: number) {
  return [
    { kind: "five_hour", percentUsed: hour, resetsAt: new Date(NOW + 90 * 60_000).toISOString() },
    { kind: "seven_day", percentUsed: week, resetsAt: new Date(NOW + 3 * 86_400_000).toISOString() },
  ];
}

async function mountBand($: any, bodyColumns = 120) {
  return $.ui.mount({
    plugin: "usage-meter",
    surface: "terminal",
    component: "AbovePrompt",
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns },
  } as any);
}

describe("usage-meter", () => {
  test("shows 5-hour and weekly usage with the 5-hour reset", async ($, on) => {
    let rateLimits = limits(34, 18);
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("session.usage", () => ({
      value: { startedAt: 0, rateLimits, context: { tokens: 1_000, window: 200_000, percent: 1 } },
    }));
    on("clock.now", () => ({ value: NOW }));
    on("turn.complete", () => ({ text: "" }));

    await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" } as any);
    const ui = await mountBand($);
    expect(await ui.find({ type: "Text", text: /^5h/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^34%$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^week/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^18%$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /resets \d\d:\d\d \(in 1h 30m\)/ })).toBeDefined();
    // 34% of 10 cells: 3 filled in color, 7 empty and dimmed.
    expect(await ui.find({ type: "Text", text: /^███$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^░{7} $/, props: { dimColor: true } })).toBeDefined();

    rateLimits = limits(81, 52);
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    expect(await ui.find({ type: "Text", text: /^81%$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^52%$/ })).toBeDefined();
    await ui.unmount();
  });

  test("shows a placeholder before any rate limits arrive", async ($, on) => {
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("session.usage", () => ({
      value: { startedAt: 0, rateLimits: [], context: { window: 200_000 } },
    }));
    on("clock.now", () => ({ value: NOW }));

    await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" } as any);
    const ui = await mountBand($);
    expect(await ui.find({ type: "Text", text: /waiting for the first response/ })).toBeDefined();
    await ui.unmount();
  });

  test("draws the full band on the desktop surface", async ($, on) => {
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("session.usage", () => ({
      value: { startedAt: 0, rateLimits: limits(42, 12), context: { window: 200_000 } },
    }));
    on("clock.now", () => ({ value: NOW }));

    await $.session.start({ surface: "desktop", isInteractive: true, cwd: "/work" } as any);
    const ui = await $.ui.mount({
      plugin: "usage-meter",
      surface: "desktop",
      component: "AbovePrompt",
      props: {},
    } as any);
    expect(await ui.find({ type: "Text", text: /^42%$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /^12%$/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /resets \d\d:\d\d \(in 1h 30m\)/ })).toBeDefined();
    await ui.unmount();
  });

  test("compacts on narrow terminals", async ($, on) => {
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("session.usage", () => ({
      value: { startedAt: 0, rateLimits: limits(10, 5), context: { window: 200_000 } },
    }));
    on("clock.now", () => ({ value: NOW }));

    await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" } as any);
    const ui = await mountBand($, 50);
    expect(await ui.find({ type: "Text", text: /↻ \d\d:\d\d/ })).toBeDefined();
    await ui.unmount();
  });
});
