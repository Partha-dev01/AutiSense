import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for SharedArrayBuffer (ONNX WASM multi-threading)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle .wasm files — prevent Next.js from breaking ONNX Runtime's
      // internal WASM file loading by treating them as static assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
        generator: {
          filename: "static/wasm/[name][ext]",
        },
      });
    }
    return config;
  },
};

export default nextConfig;
