/**
 * Playwright MCP Adapter
 * Uses external Playwright MCP for browser control
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

export class PlaywrightMCPAdapter extends BaseAdapter {
  name: AdapterName = 'playwright-mcp';
  private parser = new FacebookParser();

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return config.playwright_mcp_enabled;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();

    try {
      // Note: This adapter expects Playwright MCP to be available
      // and will communicate via MCP protocol
      // For now, we'll throw an error indicating this needs MCP client
      
      throw new Error(
        'Playwright MCP adapter requires MCP client to invoke playwright tools. ' +
        'This adapter is designed to be used when facebook-scraper is called from an MCP client ' +
        'that also has Playwright MCP configured.'
      );

    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    try {
      throw new Error(
        'Playwright MCP adapter requires MCP client to invoke playwright tools.'
      );
    } catch (error) {
      return this.createSearchErrorResult(error);
    }
  }
}
