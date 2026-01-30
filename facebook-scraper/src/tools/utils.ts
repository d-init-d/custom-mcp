/**
 * Facebook Utility Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mcpDetector } from '../detector/mcp-detector.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

const ParseUrlInputSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .describe('Facebook URL to parse')
}).strict();

const ExtractDataInputSchema = z.object({
  html: z.string()
    .min(1, 'HTML content is required')
    .describe('Raw HTML content to parse'),
  type: z.enum(['posts', 'page', 'comments'])
    .default('posts')
    .describe('Type of data to extract')
}).strict();

export function registerUtilTools(server: McpServer): void {
  // Get Status Tool
  server.registerTool(
    'fb_status',
    {
      title: 'Facebook Scraper Status',
      description: `Get status of Facebook Scraper MCP.

Returns:
  - Available adapters and their priority
  - Configuration status
  - Which MCPs are detected`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      const detected = await mcpDetector.detect();
      
      const status = {
        name: 'facebook-scraper-mcp',
        version: '1.0.0',
        adapters: detected.map(d => ({
          name: d.name,
          available: d.available,
          priority: d.priority,
          reason: d.reason
        })),
        priority_order: detected.map(d => d.name),
        config: {
          brightdata_configured: !!process.env.BRIGHTDATA_API_TOKEN,
          firecrawl_configured: !!process.env.FIRECRAWL_API_KEY,
          playwright_mcp_enabled: process.env.PLAYWRIGHT_MCP_ENABLED === 'true',
          default_strategy: process.env.DEFAULT_STRATEGY || 'auto'
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  );

  // Parse URL Tool
  server.registerTool(
    'fb_parse_url',
    {
      title: 'Parse Facebook URL',
      description: `Parse a Facebook URL to extract information.

Args:
  - url (string): Facebook URL

Returns:
  URL type (post/page/group/event), ID, and other metadata.`,
      inputSchema: ParseUrlInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const url = new URL(params.url);
        const pathname = url.pathname;

        let type = 'unknown';
        let id: string | null = null;

        // Detect URL type
        if (pathname.includes('/posts/')) {
          type = 'post';
          const match = pathname.match(/\/posts\/(\d+)/);
          id = match ? match[1] : null;
        } else if (pathname.includes('/photos/')) {
          type = 'photo';
        } else if (pathname.includes('/videos/')) {
          type = 'video';
        } else if (pathname.includes('/groups/')) {
          type = 'group';
          const match = pathname.match(/\/groups\/([^/]+)/);
          id = match ? match[1] : null;
        } else if (pathname.includes('/events/')) {
          type = 'event';
          const match = pathname.match(/\/events\/(\d+)/);
          id = match ? match[1] : null;
        } else if (pathname.includes('/marketplace/')) {
          type = 'marketplace';
          const match = pathname.match(/\/item\/(\d+)/);
          id = match ? match[1] : null;
        } else if (pathname.includes('/story.php')) {
          type = 'story';
          id = url.searchParams.get('story_fbid');
        } else if (pathname.match(/^\/[^/]+\/?$/)) {
          type = 'page_or_profile';
          const match = pathname.match(/^\/([^/]+)/);
          id = match ? match[1] : null;
        }

        const result = {
          original_url: params.url,
          type,
          id,
          hostname: url.hostname,
          pathname: url.pathname,
          is_mobile: url.hostname.includes('m.facebook') || url.hostname.includes('mbasic'),
          mbasic_url: params.url.replace('www.facebook.com', 'mbasic.facebook.com')
                               .replace('m.facebook.com', 'mbasic.facebook.com')
        };

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

  // Extract Data Tool
  server.registerTool(
    'fb_extract_data',
    {
      title: 'Extract Facebook Data from HTML',
      description: `Parse raw Facebook HTML into structured data.

Useful when you have HTML from Playwright MCP or other sources.

Args:
  - html (string): Raw HTML content
  - type (string): Data type - posts/page/comments

Returns:
  Structured data extracted from HTML.`,
      inputSchema: ExtractDataInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const parser = new FacebookParser();
        let data;

        switch (params.type) {
          case 'posts':
            data = parser.parsePosts(params.html);
            break;
          case 'page':
            data = parser.parsePage(params.html);
            break;
          case 'comments':
            data = parser.parseComments(params.html);
            break;
          default:
            data = parser.parsePosts(params.html);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              type: params.type,
              data,
              items_count: Array.isArray(data) ? data.length : 1
            }, null, 2)
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
