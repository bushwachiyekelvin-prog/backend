import fastifyPlugin from 'fastify-plugin';
import { db, connection } from "../db";
export const databasePlugin = fastifyPlugin(async function (fastify) {
    // Decorate Fastify instance with db
    fastify.decorate('db', db);
    // Close DB connection gracefully when Fastify shuts down
    fastify.addHook('onClose', async (instance) => {
        try {
            await connection.end();
        }
        catch (err) {
            instance.log.warn({ err }, 'Failed to close database connection gracefully');
        }
    });
});
