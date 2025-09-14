/**
 * CORS plugin for Fastify
 * This plugin configures CORS settings for the Fastify server
 */
import { FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

export const corsPlugin = fastifyPlugin(async function (fastify: FastifyInstance) {
  const appUrl = process.env.APP_URL;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Build origin checker: support comma-separated APP_URL list
  const allowedOrigins = appUrl ? appUrl.split(',').map(o => o.trim()).filter(Boolean) : [];

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Server-to-server or same-origin requests (no Origin header)
      if (!origin) return cb(null, true);

      if (allowedOrigins.length > 0) {
        const ok = allowedOrigins.some(allowed => origin === allowed);
        return cb(null, ok);
      }

      // If not explicitly configured, allow all in non-production to ease local dev
      if (nodeEnv !== 'production') return cb(null, true);

      // Default deny in production
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'svix-id',
      'svix-timestamp',
      'svix-signature'
    ],
    exposedHeaders: ['x-request-id'],
    maxAge: 86400
  });
});
