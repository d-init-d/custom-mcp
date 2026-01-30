/**
 * Playwright MCP Adapter
 * 
 * This adapter is designed to work in two modes:
 * 1. Delegated Mode: When the MCP client (like OpenCode) can forward requests to Playwright MCP
 * 2. Passthrough Mode: Returns instructions for the client to use Playwright MCP directly
 * 
 * Since MCP servers cannot directly call other MCP servers, this adapter
 * returns structured instructions that can be processed by the orchestrator
 * or passed back to the client.
 */

import { BaseAdapter } from './base.js';
import type { AdapterName, ScrapeOptions, ScrapeResult, SearchOptions, SearchResult } from '../types/adapters.js';
import { toSingularType } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';
import { FacebookParser } from '../parsers/facebook-parser.js';

export interface PlaywrightMCPInstruction {
  tool: string;
  params: Record<string, any>;
  description: string;
}

export class PlaywrightMCPAdapter extends BaseAdapter {
  name: AdapterName = 'playwright-mcp';
  private parser = new FacebookParser();

  async isAvailable(): Promise<boolean> {
    const config = loadConfig();
    return config.playwright_mcp_enabled;
  }

  /**
   * Generate instructions for Playwright MCP
   * These can be used by the client to execute Playwright commands
   */
  private generateInstructions(url: string, action: 'scrape' | 'search'): PlaywrightMCPInstruction[] {
    const instructions: PlaywrightMCPInstruction[] = [];

    // Navigate to URL
    instructions.push({
      tool: 'playwright_browser_navigate',
      params: { url },
      description: `Navigate to ${url}`
    });

    // Wait for content
    instructions.push({
      tool: 'playwright_browser_wait_for',
      params: { time: 3 },
      description: 'Wait for page to load'
    });

    // Try to dismiss login modal
    instructions.push({
      tool: 'playwright_browser_press_key',
      params: { key: 'Escape' },
      description: 'Dismiss any modals'
    });

    // Scroll to load more content
    instructions.push({
      tool: 'playwright_browser_evaluate',
      params: { 
        function: '() => { window.scrollBy(0, 500); }'
      },
      description: 'Scroll to load more content'
    });

    // Wait a bit more
    instructions.push({
      tool: 'playwright_browser_wait_for',
      params: { time: 2 },
      description: 'Wait for dynamic content'
    });

    // Take snapshot (for parsing)
    instructions.push({
      tool: 'playwright_browser_snapshot',
      params: {},
      description: 'Capture page snapshot for parsing'
    });

    return instructions;
  }

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult> {
    const startTime = Date.now();

    try {
      const config = loadConfig();
      
      if (!config.playwright_mcp_enabled) {
        throw new Error('Playwright MCP is not enabled');
      }

      // Generate instructions for the MCP client
      const instructions = this.generateInstructions(url, 'scrape');

      // Return a special result that contains the instructions
      // The orchestrator or client can use these to interact with Playwright MCP
      return {
        success: false,
        data: null,
        adapter_used: this.name,
        error: 'PLAYWRIGHT_MCP_DELEGATION_REQUIRED',
        metadata: {
          scrape_time_ms: Date.now() - startTime,
          url,
          timestamp: new Date().toISOString(),
          // Include instructions as a hint
          instructions: JSON.stringify(instructions)
        } as any
      };

    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const searchType = options?.type || 'posts';

    try {
      const config = loadConfig();
      
      if (!config.playwright_mcp_enabled) {
        throw new Error('Playwright MCP is not enabled');
      }

      const searchUrl = `https://www.facebook.com/search/${searchType}?q=${encodeURIComponent(query)}`;
      const instructions = this.generateInstructions(searchUrl, 'search');

      return {
        success: false,
        data: null,
        adapter_used: this.name,
        error: 'PLAYWRIGHT_MCP_DELEGATION_REQUIRED',
        metadata: {
          search_time_ms: Date.now() - startTime,
          query,
          timestamp: new Date().toISOString(),
          instructions: JSON.stringify(instructions)
        } as any
      };

    } catch (error) {
      return this.createSearchErrorResult(error);
    }
  }

  /**
   * Parse HTML obtained from Playwright MCP
   * This can be called by the client after executing the instructions
   */
  parseHtml(html: string, type: 'posts' | 'page' | 'comments'): any {
    switch (type) {
      case 'posts':
        return this.parser.parsePosts(html);
      case 'page':
        return this.parser.parsePage(html);
      case 'comments':
        return this.parser.parseComments(html);
      default:
        return this.parser.parsePosts(html);
    }
  }
}
