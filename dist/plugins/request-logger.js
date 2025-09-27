import fastifyPlugin from 'fastify-plugin';
import { logger } from '../utils/logger';
export const requestLoggerPlugin = fastifyPlugin(async function (fastify) {
    // Decorate request with a startTime property to compute response duration
    fastify.decorateRequest('startTime', 0n);
    fastify.addHook('onRequest', async (request, reply) => {
        const { method, url, ip, id } = request;
        // Propagate request id to client for correlation
        reply.header('x-request-id', id);
        // mark start time (high-resolution)
        request.startTime = process.hrtime.bigint();
        logger.info(`Incoming request [${id}]: ${method} ${url} from ${ip}`);
    });
    fastify.addHook('onResponse', async (request, reply) => {
        const { method, url, ip, id } = request;
        const { statusCode } = reply;
        const end = process.hrtime.bigint();
        const durationMs = Number((end - request.startTime) / 1000000n);
        logger.info(`Completed [${id}]: ${method} ${url} ${statusCode} in ${durationMs}ms from ${ip}`);
    });
    // Log errors in a centralized way
    fastify.addHook('onError', async (request, reply, error) => {
        const { method, url, id } = request;
        logger.error(`Error in request [${id}]: ${method} ${url}`, error);
    });
});
