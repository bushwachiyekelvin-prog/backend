import { logger } from './logger';
export function errorHandler(error, request, reply) {
    // Log the error
    logger.error(error.message || 'Unhandled error', error);
    // Determine status code
    const statusCode = error.statusCode || 500;
    // Prepare error response
    const errorResponse = {
        error: error.message || 'Internal Server Error',
        code: error.code || 'INTERNAL_SERVER_ERROR',
    };
    // Send error response
    reply.status(statusCode).send(errorResponse);
}
