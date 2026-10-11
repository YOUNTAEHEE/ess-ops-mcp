FROM node:24-bookworm-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir -p /app/data && chown node:node /app/data
COPY lib/ops.ts lib/outcome.ts ./lib/
COPY server/index.mts ./server/index.mts
USER node
ENV HOST=0.0.0.0 PORT=3000 AUDIT_DB=/app/data/audit.sqlite
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--experimental-strip-types","server/index.mts"]
