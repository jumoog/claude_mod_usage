export type UsageMeterLimit = { percent: number; resetsAt: string };

export type UsageMeterSnapshot = {
  limits: { five_hour?: UsageMeterLimit; seven_day?: UsageMeterLimit };
  now: number;
};

declare module "claude-code" {
  interface PluginState {
    "usage-meter": { snapshot: UsageMeterSnapshot };
  }
}
