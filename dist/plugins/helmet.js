import fastifyPlugin from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';
export const helmetPlugin = fastifyPlugin(async function (fastify) {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    await fastify.register(fastifyHelmet, {
        crossOriginResourcePolicy: false,
        contentSecurityPolicy: isProd
            ? {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:'],
                },
            }
            : false,
    });
});
