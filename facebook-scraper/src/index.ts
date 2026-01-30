#!/usr/bin/env node
/**
 * Facebook Scraper MCP Server
 * 
 * Hybrid MCP that automatically detects and uses available MCPs:
 * 1. Bright Data (if configured) - Best anti-block
 * 2. Firecrawl (if configured) - Good scraping
 * 3. Playwright MCP (if enabled) - Browser control
 * 4. Standalone (always available) - Built-in Playwright fallback
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerSearchTools } from './tools/search.js';
import { registerScrapeTools } from './tools/scrape.js';
import { registerUtilTools } from './tools/utils.js';
import { mcpDetector } from './detector/mcp-detector.js';
import { orchestrator } from './orchestrator/strategy.js';

// Create MCP server
const server = new McpServer({
  name: 'facebook-scraper-mcp',
  version: '1.0.0'
});

// Register all tools
registerSearchTools(server);
registerScrapeTools(server);
registerUtilTools(server);

// Main function
async function main(): Promise<void> {
  console.error('='.repeat(50));
  console.error('Facebook Scraper MCP Server v1.0.0');
  console.error('='.repeat(50));

  // Detect available MCPs
  console.error('\n[Startup] Detecting available MCPs...');
  const detected = await mcpDetector.detect();
  
  console.error(`\n[Startup] Found ${detected.length} adapters:`);
  for (const mcp of detected) {
    const status = mcp.available ? '✅' : '⬜';
    console.error(`  ${status} [Priority ${mcp.priority}] ${mcp.name}: ${mcp.reason}`);
  }

  // Initialize orchestrator
  await orchestrator.initialize();

  console.error('\n[Startup] Available tools:');
  console.error('  - fb_search: Search Facebook');
  console.error('  - fb_scrape_page: Scrape Facebook page');
  console.error('  - fb_scrape_post: Scrape single post');
  console.error('  - fb_scrape_comments: Scrape comments');
  console.error('  - fb_status: Check MCP status');
  console.error('  - fb_parse_url: Parse Facebook URL');
  console.error('  - fb_extract_data: Extract data from HTML');

  // Connect transport
  console.error('\n[Startup] Starting stdio transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[Startup] ✅ Server ready and listening');
  console.error('='.repeat(50));

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('\n[Shutdown] Cleaning up...');
    await orchestrator.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\n[Shutdown] Cleaning up...');
    await orchestrator.cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
