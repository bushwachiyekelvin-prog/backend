/**
 * Fastify server entry point (flattened structure)
 */
import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { sql } from 'drizzle-orm';
import { clerkPlugin, getAuth, clerkClient } from '@clerk/fastify';
import { errorHandler } from './utils/error-handler';
import { corsPlugin } from './plugins/cors';
import { helmetPlugin } from './plugins/helmet';
import { rateLimitPlugin } from './plugins/rate-limit';
import { userRoutes } from './routes/user.routes';
import requestId from 'fastify-request-id';
import { rawBodyPlugin } from './plugins/raw-body';
import { requestLoggerPlugin } from "./plugins/request-logger";
import { swaggerPlugin } from "./plugins/swagger";
import { databasePlugin } from "./plugins/database";

config();

const PORT = Number(process.env.PORT || 8081);
const HOST = process.env.HOST || '0.0.0.0';

const app: FastifyInstance = Fastify({
  logger: true,
});

async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(errorHandler);

  await fastify.register(requestId);
  await fastify.register(rawBodyPlugin);

  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(requestLoggerPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(databasePlugin);

  await fastify.register(clerkPlugin);
  await fastify.register(userRoutes, { prefix: '/user' });

  fastify.get('/', async () => {
    return { message: 'Hello from Fastify!' };
  });

  fastify.get('/health', async (request, reply) => {
    try {
      const result = await fastify.db.execute(sql`SELECT 1 AS ok`);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: { connected: true },
        version: process.env.npm_package_version || '1.0.0',
      };
    } catch (err) {
      request.log.error(err, 'Database health check failed');
      return reply.status(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: { connected: false },
        error: 'Database connection failed',
      });
    }
  });

  fastify.get('/protected', async (request, reply) => {
    try {
      const { isAuthenticated, userId } = getAuth(request);
      if (!isAuthenticated || !userId) {
        return reply.code(401).send({ error: 'User not authenticated' });
      }
      const user = await clerkClient.users.getUser(userId);
      return reply.send({ message: 'User retrieved successfully', user });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve user' });
    }
  });
}

export async function startServer(): Promise<FastifyInstance> {
  try {
    await registerPlugins(app);
    await app.listen({ port: PORT, host: HOST });
    const address = app.server.address();
    const serverPort = typeof address === 'object' && address !== null ? address.port : PORT;
    logger.info(`🚀 Fastify server running at http://${HOST}:${serverPort}`);
    return app;
  } catch (err: any) {
    logger.error(err?.message);
    process.exit(1);
  }
}

export { app };

// Start the server when this module is executed directly
// This ensures `bun run src/server.ts` boots the server.
void startServer();
