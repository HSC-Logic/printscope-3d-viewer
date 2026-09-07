import { beforeEach, describe, expect, it } from "vitest";
import {
  defaults,
  importSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  validateSettings,
} from "./settingsStorage";
describe("versioned settings", () => {
  beforeEach(() => localStorage.clear());
  it("persists settings", () => {
    saveSettings({ ...defaults(), currency: "USD" });
    expect(loadSettings().currency).toBe("USD");
  });
  it("rejects invalid imports", () =>
    expect(() => importSettings("{bad")).toThrow("valid JSON"));
  it("falls back for outdated data", () => {
    localStorage.setItem("printscope.settings.v1", '{"version":0}');
    expect(loadSettings().version).toBe(1);
  });
  it("restores defaults", () => {
    saveSettings({ ...defaults(), buffer: 99 });
    expect(resetSettings().buffer).toBe(10);
  });
  it("rejects empty profiles, invalid nested values and duplicate ids", () => {
    const base = defaults();
    expect(validateSettings({ ...base, printers: [] })).toBe(false);
    expect(
      validateSettings({
        ...base,
        materials: [{ ...base.materials[0], density: 0 }],
      }),
    ).toBe(false);
    expect(
      validateSettings({
        ...base,
        printers: [base.printers[0], base.printers[0]],
      }),
    ).toBe(false);
  });
});
