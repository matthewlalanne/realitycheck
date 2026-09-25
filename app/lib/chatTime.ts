// iMessage-style time formatting for the chat.
//
// A divider is shown only when there's been a real break in the conversation,
// so a burst of messages stays uninterrupted while an overnight gap gets a
// clear marker.
const GAP_MS = 60 * 60 * 1000; // an hour of quiet earns a divider

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function timeOnly(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "9:41 AM" — the per-message stamp revealed by swiping. */
export function messageTime(ms: number) {
  return ms ? timeOnly(new Date(ms)) : '';
}

/**
 * The centred divider label, or null when this message follows close enough
 * behind the previous one that a divider would just be noise.
 *
 * Today    -> "9:41 AM"
 * Yesterday-> "Yesterday 9:41 AM"
 * This week-> "Tue 9:41 AM"
 * Older    -> "Sep 16, 2026 9:41 AM"
 */
export function dividerLabel(ms: number, prevMs: number | null): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  if (prevMs) {
    const p = new Date(prevMs);
    if (sameDay(d, p) && ms - prevMs < GAP_MS) return null;
  }

  const now = new Date();
  if (sameDay(d, now)) return timeOnly(d);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday ${timeOnly(d)}`;

  // Inside the last week, the weekday is friendlier than a date.
  if (now.getTime() - ms < 7 * 24 * 60 * 60 * 1000) {
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${timeOnly(d)}`;
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString([], sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${date} ${timeOnly(d)}`;
}
