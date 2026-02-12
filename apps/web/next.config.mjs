/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Use SWC even if a Babel config is expected (e.g. from cache); avoids ENOENT when .babelrc is missing
    forceSwcTransforms: true,
  },
  // Redirect trailing slashes so /t/abc/ and /q/xyz/ work like /t/abc and /q/xyz (some scanners add a slash)
  async redirects() {
    return [
      { source: "/t/:path+/", destination: "/t/:path+", permanent: false },
      { source: "/q/:path+/", destination: "/q/:path+", permanent: false },
      { source: "/guest/:path+/", destination: "/guest/:path+", permanent: false },
    ];
  },
};

export default nextConfig;
