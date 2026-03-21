FROM denoland/deno:2.5.6

WORKDIR /app

COPY . .

EXPOSE 3000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "--unstable-sloppy-imports", "examples/main.ts"]
