FROM oven/bun:1.4.4
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
COPY *.ts ./
ENV DATA_DIR=/data
CMD ["bun", "bot.ts"]
