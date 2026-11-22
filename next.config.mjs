/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better debugging
  experimental: {
    serverComponentsExternalPackages: [],
  },

  // Allow remote images and SVGs from placehold.co and Unsplash
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      // AI virtual try-on provider output URLs.
      {
        protocol: "https",
        hostname: "cdn.fashn.ai",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.replicate.delivery",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Headers configuration for better Chrome DevTools support
  async headers() {
    return [
      {
        source: '/.well-known/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // Webpack configuration for better debugging
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },

  // Proxy browser API calls to the Express backend on the same origin.
  // The frontend only ever talks to /api/*; PostgreSQL, Kafka and OpenSearch
  // stay server-side. Override the target with API_PROXY_TARGET if needed.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
