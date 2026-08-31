import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

// Android app (Capacitor WebView) me `capture="environment"` file input unreliable
// hai — ye gallery/picker khol deta hai, camera nahi. Isliye native Camera plugin
// se direct system camera kholte hain. Web (browser) me ya plugin fail ho toh
// null return hota hai aur caller file-input fallback use karta hai.
export function isNativeCameraAvailable(): boolean {
  try {
    return typeof Capacitor !== "undefined" && !!Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function base64ToFile(base64: string, mime: string, ext: string): Promise<File> {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], `camera-${Date.now()}.${ext}`, { type: mime });
}

// Directly opens the native camera and returns the captured image as a File.
// In web (or if the plugin is unavailable/fails) returns null — caller should
// fall back to the hidden `<input type="file" capture="environment">`.
export async function captureNativePhoto(): Promise<File | null> {
  if (!isNativeCameraAvailable()) return null;
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 85,
      correctOrientation: true,
      allowEditing: false,
    });
    if (!photo.base64String) return null;
    const isPng = photo.format === "png";
    return await base64ToFile(
      photo.base64String,
      isPng ? "image/png" : "image/jpeg",
      isPng ? "png" : "jpg"
    );
  } catch {
    return null;
  }
}

// Camera button helper. Native app me directly camera kholta hai aur captured
// File ko `onFile` ko deta hai. Web (ya plugin fail) me hidden file-input ke
// `fallbackRef.click()` se `capture="environment"` picker kholta hai.
export async function openCamera(
  onFile: (file: File) => void,
  fallbackRef: { current: HTMLElement | null }
): Promise<void> {
  if (isNativeCameraAvailable()) {
    const file = await captureNativePhoto();
    if (file) {
      onFile(file);
      return;
    }
  }
  fallbackRef.current?.click();
}
