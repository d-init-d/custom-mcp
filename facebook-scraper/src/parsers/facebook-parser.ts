/**
 * Facebook HTML Parser
 * Parses Facebook HTML content into structured data
 */

import * as cheerio from 'cheerio';
import type { FacebookPost, FacebookPage, FacebookComment } from '../types/facebook.js';

export class FacebookParser {
  
  /**
   * Parse posts from Facebook HTML
   */
  parsePosts(html: string): FacebookPost[] {
    const $ = cheerio.load(html);
    const posts: FacebookPost[] = [];

    // Selectors for mbasic.facebook.com
    const mbasicSelectors = [
      'div[data-ft]',
      'article',
      'div.story_body_container',
      'div#m_story_permalink_view'
    ];

    // Selectors for regular facebook.com
    const regularSelectors = [
      '[data-pagelet*="FeedUnit"]',
      'div[data-testid="post_message"]',
      'div.userContentWrapper'
    ];

    const allSelectors = [...mbasicSelectors, ...regularSelectors];

    for (const selector of allSelectors) {
      $(selector).each((index, element) => {
        try {
          const post = this.parsePostElement($, $(element));
          if (post && post.content) {
            posts.push(post);
          }
        } catch {
          // Skip malformed posts
        }
      });

      if (posts.length > 0) break;
    }

    // Fallback: try to find any text content that looks like posts
    if (posts.length === 0) {
      $('p, span, div').each((index, element) => {
        const text = $(element).text().trim();
        if (text.length > 50 && text.length < 5000) {
          posts.push({
            id: `post_${index}`,
            author: 'Unknown',
            content: text.substring(0, 500),
            post_url: ''
          });
        }
      });
    }

    return posts.slice(0, 50); // Limit to 50 posts
  }

  private parsePostElement($: cheerio.CheerioAPI, element: cheerio.Cheerio<cheerio.Element>): FacebookPost | null {
    // Try to extract post ID
    const dataFt = element.attr('data-ft');
    let postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (dataFt) {
      try {
        const ftData = JSON.parse(dataFt);
        if (ftData.mf_story_key) {
          postId = String(ftData.mf_story_key);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Extract author
    const authorElement = element.find('a strong, h3 a, a[href*="/profile"], a[href*="/pages"]').first();
    const author = authorElement.text().trim() || 'Unknown';
    const authorUrl = authorElement.attr('href') || undefined;

    // Extract content
    const contentSelectors = [
      'div[data-testid="post_message"]',
      'div.story_body_container > div',
      'p',
      'span'
    ];

    let content = '';
    for (const sel of contentSelectors) {
      const found = element.find(sel).first().text().trim();
      if (found && found.length > content.length) {
        content = found;
      }
    }

    if (!content) {
      content = element.text().trim().substring(0, 1000);
    }

    // Extract timestamp
    const timeElement = element.find('abbr, time, span[data-utime]').first();
    const timestamp = timeElement.attr('title') || timeElement.attr('data-utime') || timeElement.text().trim() || undefined;

    // Extract post URL
    const linkElement = element.find('a[href*="/story"], a[href*="/posts/"], a[href*="/permalink"]').first();
    let postUrl = linkElement.attr('href') || '';
    if (postUrl && !postUrl.startsWith('http')) {
      postUrl = `https://www.facebook.com${postUrl}`;
    }

    // Extract reactions (basic count from mbasic)
    const reactionsText = element.find('span[id*="like"], a[href*="reaction"]').text();
    const reactionsMatch = reactionsText.match(/(\d+)/);
    const reactionsTotal = reactionsMatch ? parseInt(reactionsMatch[1]) : 0;

    // Extract comments count
    const commentsText = element.find('a[href*="comment"]').text();
    const commentsMatch = commentsText.match(/(\d+)/);
    const commentsCount = commentsMatch ? parseInt(commentsMatch[1]) : 0;

    // Extract images
    const images: string[] = [];
    element.find('img[src*="fbcdn"]').each((_, img) => {
      const src = $(img).attr('src');
      if (src) images.push(src);
    });

    return {
      id: postId,
      author,
      author_url: authorUrl,
      content: content.substring(0, 2000),
      timestamp,
      reactions: reactionsTotal > 0 ? { total: reactionsTotal } : undefined,
      comments_count: commentsCount || undefined,
      images: images.length > 0 ? images : undefined,
      post_url: postUrl
    };
  }

  /**
   * Parse page info from Facebook HTML
   */
  parsePage(html: string): FacebookPage | null {
    const $ = cheerio.load(html);

    try {
      const name = $('h1, title').first().text().trim().replace(' | Facebook', '').replace(' - Facebook', '');
      const description = $('meta[name="description"]').attr('content') || '';
      const url = $('meta[property="og:url"]').attr('content') || '';
      const profileImage = $('img[alt*="profile"], img.profilePicThumb').first().attr('src') || undefined;

      // Extract followers/likes count
      const statsText = $('body').text();
      const followersMatch = statsText.match(/([\d,.]+)\s*followers?/i);
      const likesMatch = statsText.match(/([\d,.]+)\s*likes?/i);

      const followers = followersMatch ? parseInt(followersMatch[1].replace(/[^\d]/g, '')) : undefined;
      const likes = likesMatch ? parseInt(likesMatch[1].replace(/[^\d]/g, '')) : undefined;

      return {
        id: url.split('/').pop() || '',
        name,
        url,
        description,
        followers,
        likes,
        profile_image: profileImage
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse comments from Facebook HTML
   */
  parseComments(html: string): FacebookComment[] {
    const $ = cheerio.load(html);
    const comments: FacebookComment[] = [];

    const commentSelectors = [
      'div[data-testid="comment"]',
      'div.UFIComment',
      'div[id*="comment"]'
    ];

    for (const selector of commentSelectors) {
      $(selector).each((index, element) => {
        const author = $(element).find('a').first().text().trim() || 'Unknown';
        const content = $(element).find('span, p').text().trim();
        
        if (content) {
          comments.push({
            id: `comment_${index}`,
            author,
            content: content.substring(0, 1000),
            timestamp: undefined,
            reactions_count: 0,
            replies_count: 0
          });
        }
      });

      if (comments.length > 0) break;
    }

    return comments;
  }
}
