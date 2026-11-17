/** @type {import('next').NextConfig} */
const pwaVersion =
  process.env.NEXT_PUBLIC_PWA_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  Date.now().toString(36);

const isDev = process.env.NODE_ENV !== "production";

// The browser only talks to this site and to Firebase Analytics; AI providers are called from API routes.
// 'unsafe-inline' scripts: the theme script in <head> and Next's inline bootstrap; 'unsafe-eval' only for dev refresh.
// ponytail: nonce-based script-src would drop 'unsafe-inline' but needs middleware on every page.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone is used by speaking practice on this site only.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  env: {
    NEXT_PUBLIC_PWA_VERSION: pwaVersion,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
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
