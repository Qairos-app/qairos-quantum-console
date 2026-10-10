# Deployment

Build with pnpm build. Serve dist/ over HTTPS; /app/ must resolve to dist/app/index.html. Proxy /api to the separately configured API. Set SITE_ORIGIN from your verified public domain before building deployment-specific metadata. Do not deploy source environment files or node_modules.
