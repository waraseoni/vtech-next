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

export function cameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const name = (err as DOMException).name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Camera permission denied — browser ke address bar se camera allow karein.";
    }
    if (name === "NotFoundError") {
      return "Camera nahi mili — external scanner ya manual barcode entry use karein.";
    }
    if (name === "NotReadableError") {
      return "Camera kisi aur app me already use ho raha hai — wo band karke try karein.";
    }
    if (name === "OverconstrainedError") {
      return "Camera required video settings support nahi karti.";
    }
    const m = err.message.toLowerCase();
    if (m.includes("mediadevices") || m.includes("camera streaming")) {
      return cameraUnsupportedReason();
    }
    return err.message;
  }
  const msg = String(err).toLowerCase();
  if (msg.includes("mediadevices") || msg.includes("camera streaming")) {
    return cameraUnsupportedReason();
  }
  return String(err);
}
