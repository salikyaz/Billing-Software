/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfkit ships its own font/afm binary assets that break Next's server bundler
    // unless treated as external. Same for the Graph client.
    serverComponentsExternalPackages: ["pdfkit", "@microsoft/microsoft-graph-client"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
