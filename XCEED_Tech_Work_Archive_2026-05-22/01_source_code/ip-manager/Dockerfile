FROM node:18-alpine
RUN apk add --no-cache iptables-legacy
WORKDIR /app
COPY package.json .
RUN npm install --production --no-audit --no-fund
COPY server.js .
COPY public ./public
RUN mkdir -p /app/data
EXPOSE 3010
CMD ["node", "server.js"]
