import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reality Check's OWN Firebase project (still named tribe-league-app from
// before the rename — Firebase project ids can't be renamed in place, so it
// stays that way unless this gets migrated to a new project) — deliberately
// not Outlast's (survivor-51-porterville), which runs the live private
// league. Nothing in this app may ever point at that project.
const firebaseConfig = {
  apiKey: 'AIzaSyDzZP357t1kT1-s-osKUouwsY3p4Wx20FI',
  authDomain: 'tribe-league-app.firebaseapp.com',
  databaseURL: 'https://tribe-league-app-default-rtdb.firebaseio.com',
  projectId: 'tribe-league-app',
  storageBucket: 'tribe-league-app.firebasestorage.app',
  messagingSenderId: '70015212666',
  appId: '1:70015212666:web:c5485ade0df0c7e611afc3',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const rtdb = getDatabase(app);
export const functions = getFunctions(app, 'us-central1');

// A signed-in session has to survive a relaunch, or the passphrase would be
// retyped on every cold start. That needs AsyncStorage persistence.
//
// getReactNativePersistence only exists in firebase/auth's React Native build,
// which Metro resolves at bundle time — but the package's bundled TypeScript
// types describe the web build, so it isn't visible to tsc. Reaching for it
// dynamically keeps the types honest; if it's ever missing the session simply
// falls back to in-memory and the passphrase gets asked for again.
function reactNativePersistence(): Persistence | undefined {
  try {
    const mod = require('firebase/auth') as Record<string, unknown>;
    const fn = mod.getReactNativePersistence as ((storage: unknown) => Persistence) | undefined;
    return typeof fn === 'function' ? fn(AsyncStorage) : undefined;
  } catch {
    return undefined;
  }
}

let authInstance: Auth;
try {
  const persistence = reactNativePersistence();
  authInstance = initializeAuth(app, persistence ? { persistence } : undefined);
} catch {
  // Already initialised (fast refresh in development).
  authInstance = getAuth(app);
}
export const auth = authInstance;
