/** @type {import('next').NextConfig} */
const pwaVersion =
  process.env.NEXT_PUBLIC_PWA_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  Date.now().toString(36);

const nextConfig = {
  env: {
    NEXT_PUBLIC_PWA_VERSION: pwaVersion,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
