import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which pushes this person wants. Stored on the device for now; with real
// accounts it moves to their profile so the server can respect it.
const KEY = 'confessional:notif-prefs';

export type NotifPrefs = {
  chat: boolean;
  reactions: boolean;
  recaps: boolean;
  pickReminders: boolean;
  draft: boolean;
};

export const NOTIF_OPTIONS: { key: keyof NotifPrefs; label: string; hint: string }[] = [
  { key: 'recaps', label: 'Episode results', hint: "When your league's results are ready. Never includes spoilers." },
  { key: 'pickReminders', label: 'Pick reminders', hint: "A nudge a few hours before weekly picks lock, if you haven't picked." },
  { key: 'draft', label: 'Draft alerts', hint: "Draft reminders, and when it's your turn to pick." },
  { key: 'chat', label: 'Chat messages', hint: 'New messages in your league chat.' },
  { key: 'reactions', label: 'Reactions', hint: 'When someone reacts to your message.' },
];

const DEFAULTS: NotifPrefs = { chat: true, reactions: true, recaps: true, pickReminders: true, draft: true };

export function useNotifPrefs() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => { if (raw) try { setPrefs({ ...DEFAULTS, ...JSON.parse(raw) }); } catch { /* defaults */ } });
  }, []);
  const toggle = useCallback((k: keyof NotifPrefs) => {
    setPrefs((p) => {
      const next = { ...p, [k]: !p[k] };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { prefs, toggle };
}
