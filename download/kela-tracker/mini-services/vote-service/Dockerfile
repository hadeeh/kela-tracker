FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY index.ts ./

# Expose port (Koyeb/Render/Railway set PORT env var)
ENV PORT=3003
EXPOSE 3003

# Start the server
CMD ["bun", "run", "index.ts"]
