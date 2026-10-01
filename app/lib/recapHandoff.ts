// The full-screen recap editor's text, waiting for the episode editor that
// opened it to pick up when it's back in focus. Keyed by that editor's route.
// Kept out of navigation params: setting another screen's params while this
// one closes re-triggers the close, endlessly.
const pending = new Map<string, string>();

export function putRecap(routeKey: string, text: string) {
  pending.set(routeKey, text);
}

export function takeRecap(routeKey: string): string | undefined {
  const text = pending.get(routeKey);
  pending.delete(routeKey);
  return text;
}
