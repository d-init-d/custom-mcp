/**
 * MCP Detector
 * Scans for available MCPs and returns priority-sorted list
 */

import type { DetectedMCP, AdapterName } from '../types/adapters.js';
import { loadConfig } from '../types/config.js';

export class MCPDetector {
  private detected: DetectedMCP[] = [];
  private initialized = false;

  async detect(): Promise<DetectedMCP[]> {
    if (this.initialized) {
      return this.detected;
    }

    const config = loadConfig();
    const mcps: DetectedMCP[] = [];

    // 1. Check Bright Data (Priority 1)
    if (config.brightdata_token) {
      mcps.push({
        name: 'brightdata',
        available: true,
        priority: 1,
        reason: 'BRIGHTDATA_API_TOKEN found in environment'
      });
      console.error('[MCP Detector] ✅ Bright Data MCP detected');
    } else {
      console.error('[MCP Detector] ⬜ Bright Data MCP not configured');
    }

    // 2. Check Firecrawl (Priority 2)
    if (config.firecrawl_api_key) {
      mcps.push({
        name: 'firecrawl',
        available: true,
        priority: 2,
        reason: 'FIRECRAWL_API_KEY found in environment'
      });
      console.error('[MCP Detector] ✅ Firecrawl MCP detected');
    } else {
      console.error('[MCP Detector] ⬜ Firecrawl MCP not configured');
    }

    // 3. Check Playwright MCP (Priority 3)
    if (config.playwright_mcp_enabled) {
      mcps.push({
        name: 'playwright-mcp',
        available: true,
        priority: 3,
        reason: 'PLAYWRIGHT_MCP_ENABLED is true'
      });
      console.error('[MCP Detector] ✅ Playwright MCP detected');
    } else {
      console.error('[MCP Detector] ⬜ Playwright MCP not enabled');
    }

    // 4. Standalone always available (Priority 4 - Last resort)
    mcps.push({
      name: 'standalone',
      available: true,
      priority: 4,
      reason: 'Built-in Playwright library (always available)'
    });
    console.error('[MCP Detector] ✅ Standalone adapter always available');

    // Sort by priority
    this.detected = mcps.sort((a, b) => a.priority - b.priority);
    this.initialized = true;

    console.error(`[MCP Detector] Priority order: ${this.detected.map(m => m.name).join(' → ')}`);

    return this.detected;
  }

  getDetected(): DetectedMCP[] {
    return this.detected;
  }

  isAvailable(name: AdapterName): boolean {
    return this.detected.some(m => m.name === name && m.available);
  }

  getFirst(): AdapterName {
    return this.detected[0]?.name || 'standalone';
  }
}

export const mcpDetector = new MCPDetector();
