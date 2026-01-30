/**
 * Facebook Search Tool
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { orchestrator } from '../orchestrator/strategy.js';

const SearchInputSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .max(500, 'Query too long')
    .describe('Search query'),
  type: z.enum(['posts', 'pages', 'groups', 'events', 'marketplace'])
    .default('posts')
    .describe('Type of content to search'),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum results to return'),
  strategy: z.enum(['auto', 'brightdata', 'firecrawl', 'playwright-mcp', 'standalone'])
    .default('auto')
    .describe('Scraping strategy (auto = try all in priority order)')
}).strict();

type SearchInput = z.infer<typeof SearchInputSchema>;

export function registerSearchTools(server: McpServer): void {
  server.registerTool(
    'fb_search',
    {
      title: 'Facebook Search',
      description: `Search for content on Facebook.

This tool automatically detects available MCPs and uses them in priority order:
1. Bright Data (if configured) - Best anti-block
2. Firecrawl (if configured) - Good scraping
3. Playwright MCP (if enabled) - Browser control
4. Standalone (always available) - Built-in fallback

Args:
  - query (string): Search query
  - type (string): Content type - posts/pages/groups/events/marketplace
  - limit (number): Max results (1-50, default: 10)
  - strategy (string): Force specific strategy or 'auto'

Returns:
  Search results with adapter_used indicating which MCP was used.`,
      inputSchema: SearchInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SearchInput) => {
      try {
        const result = await orchestrator.search(params.query, {
          type: params.type,
          limit: params.limit,
          strategy: params.strategy as 'auto' | 'brightdata' | 'firecrawl' | 'playwright-mcp' | 'standalone'
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );
}
