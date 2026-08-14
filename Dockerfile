FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS dev
WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/logs

EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:22-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/logs

EXPOSE 3000
CMD ["npm", "start"]
