/**
 * Facebook Scrape Tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { orchestrator } from '../orchestrator/strategy.js';

const ScrapePageInputSchema = z.object({
  page_url: z.string()
    .min(1, 'URL is required')
    .describe('Facebook page URL to scrape'),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum posts to scrape'),
  strategy: z.enum(['auto', 'brightdata', 'firecrawl', 'playwright-mcp', 'standalone'])
    .default('auto')
    .describe('Scraping strategy')
}).strict();

const ScrapePostInputSchema = z.object({
  post_url: z.string()
    .min(1, 'URL is required')
    .describe('Facebook post URL to scrape'),
  include_comments: z.boolean()
    .default(false)
    .describe('Include comments in result'),
  strategy: z.enum(['auto', 'brightdata', 'firecrawl', 'playwright-mcp', 'standalone'])
    .default('auto')
    .describe('Scraping strategy')
}).strict();

const ScrapeCommentsInputSchema = z.object({
  post_url: z.string()
    .min(1, 'URL is required')
    .describe('Facebook post URL to scrape comments from'),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum comments to scrape'),
  strategy: z.enum(['auto', 'brightdata', 'firecrawl', 'playwright-mcp', 'standalone'])
    .default('auto')
    .describe('Scraping strategy')
}).strict();

export function registerScrapeTools(server: McpServer): void {
  // Scrape Page Tool
  server.registerTool(
    'fb_scrape_page',
    {
      title: 'Scrape Facebook Page',
      description: `Scrape posts from a Facebook page/fanpage.

Automatically uses best available MCP in priority order:
1. Bright Data → 2. Firecrawl → 3. Playwright MCP → 4. Standalone

Args:
  - page_url (string): Facebook page URL
  - limit (number): Max posts (1-50, default: 20)
  - strategy (string): 'auto' or specific adapter

Returns:
  Array of posts with content, reactions, comments count, etc.`,
      inputSchema: ScrapePageInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const result = await orchestrator.scrapePage(params.page_url, {
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

  // Scrape Post Tool
  server.registerTool(
    'fb_scrape_post',
    {
      title: 'Scrape Facebook Post',
      description: `Scrape a single Facebook post with full details.

Args:
  - post_url (string): Facebook post URL
  - include_comments (boolean): Include comments (default: false)
  - strategy (string): Scraping strategy

Returns:
  Post details including content, author, reactions, comments, shares.`,
      inputSchema: ScrapePostInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const result = await orchestrator.scrapePost(params.post_url, {
          include_comments: params.include_comments,
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

  // Scrape Comments Tool
  server.registerTool(
    'fb_scrape_comments',
    {
      title: 'Scrape Facebook Comments',
      description: `Scrape comments from a Facebook post.

Args:
  - post_url (string): Facebook post URL
  - limit (number): Max comments (1-100, default: 50)
  - strategy (string): Scraping strategy

Returns:
  Array of comments with author, content, reactions, replies.`,
      inputSchema: ScrapeCommentsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const result = await orchestrator.scrapeComments(params.post_url, {
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
