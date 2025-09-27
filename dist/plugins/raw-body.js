import fastifyPlugin from 'fastify-plugin';
import rawBody from 'fastify-raw-body';
export const rawBodyPlugin = fastifyPlugin(async function (fastify) {
    await fastify.register(rawBody, {
        field: 'rawBody',
        global: false,
        encoding: 'utf8',
        runFirst: true,
    });
});
