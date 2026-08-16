/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // Hide the floating Next.js logo badge shown in development mode.
  devIndicators: false,
};

export default nextConfig;
