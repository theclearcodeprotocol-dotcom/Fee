import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root is a HyperFrames video project with its own package.json;
  // pin the workspace root so Next doesn't trace files from the parent folder.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
