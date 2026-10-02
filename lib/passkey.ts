// Sign in with Face ID / Touch ID / fingerprint: passkeys, kept by Supabase
// Auth (Authentication → Passkeys in the dashboard). Browser-only helpers.

// Set on this device once its member turns passkeys on or signs in with one,
// so the login page only offers the button where it can work.
const HAS_PASSKEY_KEY = "passkey-on-this-device";

export function passkeysSupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

// What the device's own prompt calls it, so the button matches what pops up.
export function biometricName() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "Face ID";
  if (/Macintosh/.test(ua)) return "Touch ID";
  if (/Android/.test(ua)) return "fingerprint";
  if (/Windows/.test(ua)) return "Windows Hello";
  return "a passkey";
}

export function rememberPasskeyHere() {
  try {
    localStorage.setItem(HAS_PASSKEY_KEY, "1");
  } catch {
    // private browsing: the login button just won't show on its own
  }
}

export function forgetPasskeyHere() {
  try {
    localStorage.removeItem(HAS_PASSKEY_KEY);
  } catch {
    // nothing to forget
  }
}

export function passkeyRememberedHere() {
  try {
    return localStorage.getItem(HAS_PASSKEY_KEY) === "1";
  } catch {
    return false;
  }
}

type PasskeyError = { code?: string; cause?: unknown; message?: string } | null | undefined;

// The member closed the Face ID prompt: not worth an error message.
export function passkeyCancelled(error: PasskeyError) {
  if (!error) return false;
  const cause = error.cause as { name?: string } | undefined;
  return error.code === "ERROR_CEREMONY_ABORTED" || cause?.name === "NotAllowedError" || cause?.name === "AbortError";
}

// Turned off for the project (or not yet turned on).
export function passkeysOff(error: PasskeyError) {
  return error?.code === "passkey_disabled";
}

export function passkeyErrorMessage(error: PasskeyError, name: string) {
  switch (error?.code) {
    case "passkey_disabled":
      return `Signing in with ${name} isn't turned on yet.`;
    case "webauthn_credential_not_found":
      return `That ${name} sign-in isn't set up for any account here. Sign in with your password, then turn on ${name} from Home.`;
    case "webauthn_credential_exists":
    case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
      return `${name} is already set up on this device.`;
    case "webauthn_challenge_expired":
      return "That took too long. Try again.";
    case "too_many_passkeys":
      return "You've set up the most devices allowed. Remove one first.";
    default:
      return error?.message || `Couldn't use ${name}. Sign in with your password instead.`;
  }
}
