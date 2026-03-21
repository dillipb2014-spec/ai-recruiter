const { PrismaClient } = require("@prisma/client");

// Singleton — reuse across hot reloads in dev
const prisma = global._prisma ?? new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") global._prisma = prisma;

module.exports = prisma;
