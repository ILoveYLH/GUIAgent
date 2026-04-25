import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@cornerstonejs/core",
    "@cornerstonejs/dicom-image-loader",
    "@cornerstonejs/tools",
    "dcmjs",
  ],
  /** Cornerstone codec 的 wasm 胶水代码会静态 require('fs')，浏览器打包需置空 */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
