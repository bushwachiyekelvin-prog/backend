declare module 'fastify-request-id' {
  import { FastifyPluginCallback } from 'fastify';
  interface RequestIdPluginOptions {
    generator?: () => string;
    headerName?: string;
  }
  const plugin: FastifyPluginCallback<RequestIdPluginOptions>;
  export default plugin;
}
