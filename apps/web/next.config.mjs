/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Use SWC even if a Babel config is expected (e.g. from cache); avoids ENOENT when .babelrc is missing
    forceSwcTransforms: true,
  },
};

export default nextConfig;
