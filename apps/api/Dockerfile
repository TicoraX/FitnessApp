# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
# openssl: los motores de Prisma lo necesitan en Alpine.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build
# El seed se compila aparte: nest build solo toma src/, y la imagen final no
# lleva ts-node. Sin esto no hay forma de cargar el catálogo en producción.
RUN npx tsc prisma/seed.ts prisma/foods-dataset.ts --outDir dist-seed --module commonjs --target ES2022 \
    --esModuleInterop --skipLibCheck --resolveJsonModule

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY package.json ./
# El schema y las migraciones viajan con la imagen: sin ellos el contenedor no
# puede llevar la base a la versión que su código espera.
COPY prisma ./prisma

# Usuario sin privilegios: node ya viene en la imagen oficial.
USER node
EXPOSE 3100

# ponytail: migra al arrancar. Alcanza con una sola instancia; con varias
# réplicas hay que sacarlo a un job previo para que no compitan.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
