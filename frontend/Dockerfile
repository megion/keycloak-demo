FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY proxy.conf.json ./
COPY src ./src
RUN pnpm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/myapp-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
