// Service Center mode — single source for mode-driven behaviour.
// DB me ye `system_info.meta_field = 'service_center_mode'` row hai; default
// `autonomous` (K1). Brand numbering sirf single/multi me chalna hai (K8).
export type ServiceCenterMode = "autonomous" | "single_brand" | "multi_brand";

export const DEFAULT_SERVICE_CENTER_MODE: ServiceCenterMode = "autonomous";

export function normalizeServiceCenterMode(value?: string | null): ServiceCenterMode {
  const mode = String(value ?? "")
    .trim()
    .toLowerCase();
  if (mode === "single_brand" || mode === "multi_brand") return mode;
  return DEFAULT_SERVICE_CENTER_MODE;
}

export function brandNumberingEnabled(value?: string | null): boolean {
  return normalizeServiceCenterMode(value) !== DEFAULT_SERVICE_CENTER_MODE;
}
