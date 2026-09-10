// Lightweight URL & Deep Link Router for React SPA using HTML5 History API

export function getRouteFromLocation() {
  if (typeof window === "undefined") {
    return { pathname: "/", view: "home", searchParams: new URLSearchParams(), viewMode: "grid", itemId: null };
  }

  const pathname = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);

  let view = "home";
  if (pathname.startsWith("/analyzer")) {
    view = "analyzer";
  } else if (pathname.startsWith("/gallery")) {
    view = "gallery";
  } else if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    view = "auth";
  } else {
    view = "home";
  }

  return {
    pathname: window.location.pathname,
    view,
    searchParams,
    viewMode: searchParams.get("view") || "grid",
    itemId: searchParams.get("item") || null,
  };
}

export function navigateTo(path, { replace = false } = {}) {
  if (typeof window === "undefined") return;

  const current = window.location.pathname + window.location.search;
  if (current !== path) {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
  }

  // Notify listeners (including popstate listeners in App)
  window.dispatchEvent(new PopStateEvent("popstate"));
}
