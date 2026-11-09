/** @type {import('next').NextConfig} */
const isGhPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  ...(isGhPages
    ? {
        output: 'export',
        basePath: '/hk-ai-agent-workspace',
        assetPrefix: '/hk-ai-agent-workspace/',
        images: { unoptimized: true },
      }
    : {}),
};

module.exports = nextConfig;
