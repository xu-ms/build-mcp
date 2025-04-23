# MCP WebView2 编译工具

这是一个基于 Model Context Protocol (MCP) 的工具，用于编译 WebView2 和 Chrome 浏览器。

## 功能特点

- 使用 autoninja 命令编译 WebView2 和 Chrome 浏览器
- 支持指定编译路径和目标
- 提供简单的命令行界面

## 安装

```bash
# 克隆仓库
git clone https://github.com/xu-ms/build-mcp.git

cd build-mcp

# 安装依赖
npm install
```

## 使用方法

### 编译项目

```bash
# 编译 TypeScript 代码
npm run build
```
### ecline_mcp_settings.json
```
    "compile-mcp": {
      "command": "node path",
      "args": [
        "/pathto/dist/server.js"
      ],
      "disabled": false,
      "timeout": 3600
    }

```


### 测试客户端

```bash
# 测试编译 WebView2
npm run test:webview

# 测试编译 Chrome
npm run test:chrome

# 或者直接运行客户端（开发模式）
npm run dev:client
```