FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY proxy.conf.json ./
COPY src ./src
RUN npx ng build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/myapp-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
