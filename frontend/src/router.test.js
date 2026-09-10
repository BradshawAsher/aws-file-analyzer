import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRouteFromLocation, navigateTo } from "./router";

describe("router helper", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("identifies root path as home view", () => {
    window.history.replaceState({}, "", "/");
    const route = getRouteFromLocation();
    expect(route.view).toBe("home");
    expect(route.viewMode).toBe("grid");
    expect(route.itemId).toBeNull();
  });

  it("identifies /analyzer as analyzer view", () => {
    window.history.replaceState({}, "", "/analyzer");
    const route = getRouteFromLocation();
    expect(route.view).toBe("analyzer");
  });

  it("identifies /gallery as gallery view and extracts query parameters", () => {
    window.history.replaceState({}, "", "/gallery?view=map&item=42");
    const route = getRouteFromLocation();
    expect(route.view).toBe("gallery");
    expect(route.viewMode).toBe("map");
    expect(route.itemId).toBe("42");
  });

  it("identifies /login and /auth as auth view", () => {
    window.history.replaceState({}, "", "/login");
    expect(getRouteFromLocation().view).toBe("auth");

    window.history.replaceState({}, "", "/auth");
    expect(getRouteFromLocation().view).toBe("auth");
  });

  it("navigateTo updates window history and dispatches popstate event", () => {
    const popStateSpy = vi.fn();
    window.addEventListener("popstate", popStateSpy);

    navigateTo("/gallery?view=map");

    expect(window.location.pathname).toBe("/gallery");
    expect(window.location.search).toBe("?view=map");
    expect(popStateSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", popStateSpy);
  });

  it("navigateTo supports replace mode", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    navigateTo("/analyzer", { replace: true });
    expect(replaceSpy).toHaveBeenCalled();
    replaceSpy.mockRestore();
  });
});
