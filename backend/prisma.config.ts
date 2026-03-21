import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,          // pooler port 6543 — used by app
    directUrl: process.env.DIRECT_URL!,      // direct port 5432 — used by db:push
  },
});
