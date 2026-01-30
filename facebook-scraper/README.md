# Facebook Scraper MCP

MCP Server để cào dữ liệu và tìm kiếm từ Facebook với kiến trúc **Hybrid** - tự động phát hiện và sử dụng các MCP đã cài sẵn.

## ✨ Tính năng

- **Hybrid Architecture**: Tự động detect và sử dụng MCP tốt nhất có sẵn
- **Smart Fallback**: Tự động chuyển sang adapter khác khi gặp lỗi
- **Anti-Detection**: Tích hợp stealth mode để tránh bị Facebook block
- **Multiple Data Types**: Hỗ trợ scrape posts, pages, comments, events, groups

## 🏗️ Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    Facebook Scraper MCP                      │
├─────────────────────────────────────────────────────────────┤
│                         Tools                                │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │fb_search │ │fb_scrape_*   │ │fb_status/parse/extract │   │
│  └────┬─────┘ └──────┬───────┘ └───────────┬────────────┘   │
│       │              │                      │                │
├───────┴──────────────┴──────────────────────┴───────────────┤
│                      Orchestrator                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Strategy Selection + Fallback Logic                 │    │
│  └──────────────────────┬──────────────────────────────┘    │
├─────────────────────────┴───────────────────────────────────┤
│                        Adapters                              │
│  ┌────────────┐ ┌───────────┐ ┌────────────┐ ┌──────────┐   │
│  │ BrightData │ │ Firecrawl │ │ Playwright │ │Standalone│   │
│  │  Priority 1│ │ Priority 2│ │ Priority 3 │ │Priority 4│   │
│  └────────────┘ └───────────┘ └────────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Cài đặt

### 1. Clone và Build

```bash
# Clone repo
git clone https://github.com/d-init-d/custom-mcp.git
cd custom-mcp/facebook-scraper

# Cài dependencies
npm install

# Build
npm run build
```

### 2. Cấu hình OpenCode

Thêm vào file `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "servers": {
      "facebook-scraper": {
        "command": "node",
        "args": ["/path/to/custom-mcp/facebook-scraper/dist/index.js"],
        "env": {
          "BRIGHTDATA_API_TOKEN": "your-token-here",
          "FIRECRAWL_API_KEY": "your-key-here",
          "PLAYWRIGHT_MCP_ENABLED": "true"
        }
      }
    }
  }
}
```

## 🔧 Cấu hình Adapters

### Thứ tự ưu tiên

| Priority | Adapter | Điều kiện kích hoạt | Ưu điểm |
|----------|---------|---------------------|---------|
| 1 | **Bright Data** | `BRIGHTDATA_API_TOKEN` | Anti-detection tốt nhất, proxy rotating |
| 2 | **Firecrawl** | `FIRECRAWL_API_KEY` | Nhanh, ổn định |
| 3 | **Playwright MCP** | `PLAYWRIGHT_MCP_ENABLED=true` | Tận dụng MCP có sẵn |
| 4 | **Standalone** | Luôn có | Fallback cuối, miễn phí |

### Environment Variables

```bash
# Bright Data (Recommended)
BRIGHTDATA_API_TOKEN=your-brightdata-token

# Firecrawl
FIRECRAWL_API_KEY=your-firecrawl-key

# Playwright MCP
PLAYWRIGHT_MCP_ENABLED=true

# General
FB_SCRAPER_TIMEOUT=30000
FB_SCRAPER_MAX_RETRIES=3
FB_SCRAPER_DEBUG=false
```

## 🛠️ Tools

### fb_search

Tìm kiếm trên Facebook.

```typescript
fb_search({
  query: "AI news",
  type: "post" | "page" | "group" | "event",
  limit: 10
})
```

### fb_scrape_page

Cào bài viết từ một Facebook Page.

```typescript
fb_scrape_page({
  url: "https://facebook.com/TechPage",
  limit: 20,
  include_comments: false
})
```

### fb_scrape_post

Cào chi tiết một bài viết cụ thể.

```typescript
fb_scrape_post({
  url: "https://facebook.com/page/posts/123456",
  include_comments: true,
  comment_limit: 50
})
```

### fb_scrape_comments

Cào comments từ một bài viết.

```typescript
fb_scrape_comments({
  post_url: "https://facebook.com/page/posts/123456",
  limit: 100,
  sort: "newest" | "top"
})
```

### fb_status

Kiểm tra trạng thái MCP và các adapters.

```typescript
fb_status()
// Returns:
// {
//   available_adapters: ["brightdata", "standalone"],
//   active_adapter: "brightdata",
//   health: "ok"
// }
```

### fb_parse_url

Phân tích URL Facebook.

```typescript
fb_parse_url({
  url: "https://facebook.com/page/posts/123456"
})
// Returns:
// {
//   type: "post",
//   page_id: "page",
//   post_id: "123456"
// }
```

### fb_extract_data

Parse HTML thành structured data (dùng kết hợp với Playwright MCP).

```typescript
fb_extract_data({
  html: "<div>...</div>",
  type: "post" | "comments" | "page"
})
```

## 📂 Cấu trúc Project

```
facebook-scraper/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── src/
    ├── index.ts                    # Entry point, MCP server setup
    ├── types/
    │   ├── facebook.ts             # Facebook data types
    │   ├── adapters.ts             # Adapter interfaces
    │   ├── config.ts               # Configuration types
    │   └── index.ts
    ├── detector/
    │   └── mcp-detector.ts         # Auto-detect available MCPs
    ├── adapters/
    │   ├── base.ts                 # Base adapter class
    │   ├── brightdata.ts           # Bright Data adapter
    │   ├── firecrawl.ts            # Firecrawl adapter
    │   ├── playwright-mcp.ts       # Playwright MCP adapter
    │   ├── standalone.ts           # Built-in Playwright (fallback)
    │   └── index.ts
    ├── orchestrator/
    │   ├── strategy.ts             # Strategy selection & fallback
    │   └── index.ts
    ├── parsers/
    │   ├── facebook-parser.ts      # Parse Facebook HTML
    │   └── index.ts
    └── tools/
        ├── search.ts               # fb_search tool
        ├── scrape.ts               # fb_scrape_* tools
        ├── utils.ts                # fb_status, fb_parse_url, fb_extract_data
        └── index.ts
```

## 🔄 Fallback Logic

```
Request → Try Adapter 1 (Bright Data)
              ↓ (fail)
         Try Adapter 2 (Firecrawl)
              ↓ (fail)
         Try Adapter 3 (Playwright MCP)
              ↓ (fail)
         Try Adapter 4 (Standalone)
              ↓ (fail)
         Return Error
```

## ⚠️ Lưu ý

1. **Rate Limiting**: Facebook có rate limit nghiêm ngặt. Sử dụng `FB_SCRAPER_DELAY` để thêm delay giữa các requests.

2. **Login Required**: Một số nội dung cần đăng nhập. Hiện tại MCP chỉ hỗ trợ public content.

3. **HTML Changes**: Facebook thường thay đổi HTML structure. Parser có thể cần cập nhật.

4. **Legal**: Đảm bảo tuân thủ Terms of Service của Facebook và luật pháp địa phương.

## 🤝 Contributing

1. Fork repo
2. Tạo branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Tạo Pull Request

## 📄 License

MIT License - Xem file [LICENSE](../LICENSE) để biết thêm chi tiết.

## 🔗 Links

- [OpenCode Documentation](https://opencode.ai/docs)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Bright Data](https://brightdata.com/)
- [Firecrawl](https://firecrawl.dev/)
