import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// Google's OAuth client for this app. GOOGLE_IOS_CLIENT_ID comes from Google
// Cloud Console (auto-created when Google sign-in is enabled in the Firebase
// console) — see README.md "Auth setup" for the one-time steps.
const GOOGLE_IOS_CLIENT_ID = '70015212666-ekju6ubos86e28a0e35jp7lb9r4nsm18.apps.googleusercontent.com';
// Google's authorization server only accepts this exact reversed-client-ID
// scheme as the callback for an "iOS" OAuth client — an arbitrary scheme
// (like the app's own `confessional://`) gets rejected as "Access blocked".
const GOOGLE_REDIRECT_SCHEME = 'com.googleusercontent.apps.70015212666-ekju6ubos86e28a0e35jp7lb9r4nsm18';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

/**
 * Runs the Google sign-in flow in the system browser and returns the ID
 * token, or null if the person cancelled. The ID token is verified
 * server-side by the `googleSignIn` Cloud Function — this only gets the
 * token, it never trusts it locally.
 *
 * Authorization-code + PKCE, not the older implicit id_token flow: Google
 * now blocks ("Access blocked") response_type=id_token for newer OAuth
 * clients like this one. Code + PKCE is the flow Google's own docs recommend
 * for native/mobile apps, and it's what expo-auth-session defaults to.
 */
export async function signInWithGoogle(): Promise<string | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: GOOGLE_REDIRECT_SCHEME });
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') return null;
  const code = result.params.code as string | undefined;
  if (!code) return null;

  // Exchange the code for tokens. This is a public client (no secret) —
  // PKCE's code_verifier stands in for one, which is why we pass it here.
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_IOS_CLIENT_ID,
      code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery,
  );
  return tokenResult.idToken ?? null;
}
