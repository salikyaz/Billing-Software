// 'unsafe-eval' is only needed by Next's dev runtime; omit it in production.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

// Security response headers applied to every route.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // clickjacking
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Harden against framing/injection without breaking Next's inline runtime.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
    ].join("; "),
  },
  // Effective only over HTTPS (production behind Nginx/Let's Encrypt).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  experimental: {
    // pdfkit ships its own font/afm binary assets that break Next's server bundler
    // unless treated as external. Same for the Graph client.
    serverComponentsExternalPackages: ["pdfkit", "@microsoft/microsoft-graph-client"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
