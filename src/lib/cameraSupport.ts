export function isCameraSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

export function cameraUnsupportedReason(): string {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "Camera sirf secure page par chalta hai. App ko localhost ya HTTPS se kholo — LAN IP (http://192.168...) se Chrome camera block kar deta hai.";
  }
  return "Browser me camera support nahi mila. Modern Chrome/Safari/Edge aur secure (HTTPS/localhost) connection use karein.";
}

/** Ek DOMException `name` -> user-friendly Hindi message. Unknown name -> null. */
function messageForName(name: string): string | null {
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied — browser ke address bar se camera allow karein.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Camera nahi mili — external scanner ya manual barcode entry use karein.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera kisi aur app me already use ho raha hai — wo band karke try karein.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Camera required video settings support nahi karti.";
  }
  return null;
}

/**
 * Fallback engine (html5-qrcode) apna error plain `Error` ke roop me deta hai —
 * `err.name` "Error" hota hai, asli wajah message ke andar hoti hai. Jaise:
 * `Error getting userMedia, error = NotAllowedError: Permission denied`.
 * Isliye message me embedded DOMException name bhi dhoondhte hain, warna user
 * ko kachcha technical text dikhta hai.
 */
const EMBEDDED_ERROR_NAME_RE =
  /(NotAllowedError|PermissionDeniedError|NotFoundError|DevicesNotFoundError|NotReadableError|TrackStartError|OverconstrainedError|ConstraintNotSatisfiedError)/;

function friendlyFromText(text: string): string | null {
  const embedded = text.match(EMBEDDED_ERROR_NAME_RE);
  return embedded ? messageForName(embedded[1]) : null;
}

export function cameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const direct = messageForName((err as DOMException).name);
    if (direct) return direct;

    const embedded = friendlyFromText(err.message);
    if (embedded) return embedded;

    const m = err.message.toLowerCase();
    if (m.includes("mediadevices") || m.includes("camera streaming")) {
      return cameraUnsupportedReason();
    }
    return err.message;
  }

  const text = String(err);
  const embedded = friendlyFromText(text);
  if (embedded) return embedded;

  const msg = text.toLowerCase();
  if (msg.includes("mediadevices") || msg.includes("camera streaming")) {
    return cameraUnsupportedReason();
  }
  return text;
}
