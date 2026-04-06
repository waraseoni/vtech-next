declare module "next-pwa" {
  import { NextConfig } from "next";

  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    buildExcludes?: string[];
    fallback?: string | false;
    cacheOnWheels?: boolean;
    publicExcludes?: string[];
    reload?: boolean;
    maxAge?: number;
    runtimeCaching?: any[];
  }

  function withPWA(config?: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
