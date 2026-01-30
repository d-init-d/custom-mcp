# Custom MCP Servers Collection

Bộ sưu tập các MCP (Model Context Protocol) Servers tự tạo để sử dụng với OpenCode, Claude Desktop, và các AI tools khác.

## 📦 Danh sách MCP Servers

| MCP Server | Mô tả | Status |
|------------|-------|--------|
| [facebook-mcp](./facebook-mcp/) | Facebook Scraper - Cào dữ liệu, tìm kiếm từ Facebook | 🚧 Đang phát triển |

## 🚀 Cài đặt

### Yêu cầu
- Node.js >= 18
- npm hoặc yarn

### Clone repo
```bash
git clone https://github.com/d-init-d/custom-mcp.git
cd custom-mcp
```

### Cài đặt từng MCP
```bash
cd facebook-mcp
npm install
npm run build
```

## 🔧 Cấu hình với OpenCode

Thêm vào file `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "facebook": {
      "type": "local",
      "command": ["node", "/path/to/custom-mcp/facebook-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

## 📁 Cấu trúc thư mục

```
custom-mcp/
├── README.md
├── facebook-mcp/          # Facebook Scraper MCP
│   ├── src/
│   ├── package.json
│   └── ...
└── [future-mcp]/          # Các MCP khác trong tương lai
```

## 🛠️ Phát triển

### Tạo MCP mới
1. Tạo thư mục mới: `mkdir my-new-mcp`
2. Copy template từ MCP có sẵn
3. Chỉnh sửa theo nhu cầu

### Guidelines
- Mỗi MCP là một thư mục riêng biệt
- Mỗi MCP có package.json và README riêng
- Sử dụng TypeScript
- Follow MCP SDK best practices

## 📝 License

MIT License

## 👤 Author

- GitHub: [@d-init-d](https://github.com/d-init-d)
