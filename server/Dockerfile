FROM node:24-bookworm-slim
WORKDIR /app
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev --ignore-scripts
COPY server ./server
COPY public/launcher.png ./public/launcher.png
ENV HOST=0.0.0.0 PORT=4783
RUN mkdir /app/.account-service && chown node:node /app/.account-service
USER node
VOLUME ["/app/.account-service"]
EXPOSE 4783
CMD ["node", "server/index.mjs"]
