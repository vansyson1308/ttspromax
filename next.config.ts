import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Edge TTS needs Node.js runtime (WebSocket with custom headers)

  // Enable WASM support for ONNX Runtime Web and Transformers.js
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },

  // Required headers for SharedArrayBuffer (needed by ONNX WASM threads)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
