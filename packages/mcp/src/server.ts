import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, executeTool } from './tools';
import { RESOURCES, readResource } from './resources';

/** Creates and configures the SafePlate Model Context Protocol (MCP) server. */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'safeplate-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;
    return executeTool(name, (args as Record<string, unknown>) ?? {});
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request): Promise<ReadResourceResult> => {
      const { uri } = request.params;
      return readResource(uri);
    },
  );

  return server;
}
