FROM oven/bun:1.2.21-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN bun install

COPY . .

EXPOSE 3000

CMD ["bun", "run", "examples/main.ts"]
