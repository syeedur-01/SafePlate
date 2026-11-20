import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';

export * from './tools';
export * from './resources';
export * from './server';

/** Starts the SafePlate MCP server using the stdio transport. */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('SafePlate MCP server running on stdio\n');
}

// Auto-run if this script is executed directly
const isDirectEntry =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') ||
    process.argv[1].endsWith('index.js') ||
    process.argv[1].endsWith('safeplate-mcp.js'));

if (isDirectEntry) {
  startMcpServer().catch((error: unknown) => {
    process.stderr.write(`Failed to start SafePlate MCP server: ${String(error)}\n`);
    process.exit(1);
  });
}
