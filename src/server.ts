import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
  } from '@modelcontextprotocol/sdk/types.js';

// 加载 shell 环境变量
function loadShellEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  
  try {
    // 读取 ~/.zprofile 文件
    const zprofilePath = join(homedir(), '.zprofile');
    if (existsSync(zprofilePath)) {
      try {
        const zprofileContent = readFileSync(zprofilePath, 'utf8');
        
        // 提取 PATH 和其他环境变量
        const exportLines = zprofileContent.match(/export\s+([A-Za-z0-9_]+)=([^\n]+)/g) || [];
        for (const line of exportLines) {
          const match = line.match(/export\s+([A-Za-z0-9_]+)=(.+)/);
          if (match && match[1] && match[2]) {
            const key = match[1];
            let value = match[2].trim();
            // 去掉引号
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            env[key] = value;
          }
        }
      } catch (error) {
        console.warn('无法读取 .zprofile 文件:', error);
      }
    }

    // 尝试读取 .zshrc 文件
    const zshrcPath = join(homedir(), '.zshrc');
    if (existsSync(zshrcPath)) {
      try {
        const zshrcContent = readFileSync(zshrcPath, 'utf8');
        
        // 提取所有 export 语句
        const exportLines = zshrcContent.match(/export\s+([A-Za-z0-9_]+)=([^\n]+)/g) || [];
        for (const line of exportLines) {
          const match = line.match(/export\s+([A-Za-z0-9_]+)=(.+)/);
          if (match && match[1] && match[2]) {
            const key = match[1];
            let value = match[2].trim();
            // 去掉引号
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            env[key] = value;
          }
        }
      } catch (error) {
        console.warn('无法读取 .zshrc 文件:', error);
      }
    }
  } catch (error) {
    console.warn('无法加载环境配置:', error);
  }
  
  return env;
}

// 创建一个 Promise 包装的 spawn 函数
function spawnPromise(command: string, args: string[], options: any): Promise<{ stdout: string; stderr: string; success: boolean; code: number | null }> {
  return new Promise<{ stdout: string; stderr: string; success: boolean; code: number | null }>((resolve) => {
    // 合并环境变量
    const shellEnv = loadShellEnv();
    const env: Record<string, string> = { 
      ...process.env,
      ...shellEnv,
      // 确保 PATH 包含常见路径
      PATH: `${shellEnv.PATH || process.env.PATH || ''}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin`
    };
    
    // 构建完整的命令，包括环境激活
    let fullCommand = '';
    
    // 输出调试信息
    fullCommand += 'echo "=== 调试信息 ==="; ';
    fullCommand += 'echo "当前 Shell: $SHELL"; ';
    fullCommand += 'echo "当前用户: $USER"; ';
    fullCommand += 'echo "HOME 目录: $HOME"; ';
    fullCommand += 'echo "===== PATH ====="; ';
    fullCommand += 'echo $PATH | tr ":" "\\n"; ';
    fullCommand += 'echo "=== Python 信息 ==="; ';
    fullCommand += 'which python || echo "找不到 python"; ';
    fullCommand += 'which python3 || echo "找不到 python3"; ';
    fullCommand += 'echo "================="; ';
    
    // 先加载 zprofile 和 zshrc
    fullCommand += 'source ~/.zprofile 2>/dev/null || true; ';
    fullCommand += 'source ~/.zshrc 2>/dev/null || true; ';
    
    // 加载后再次输出 Python 信息
    fullCommand += 'echo "=== 加载配置后的 Python 信息 ==="; ';
    fullCommand += 'which python || echo "找不到 python"; ';
    fullCommand += 'which python3 || echo "找不到 python3"; ';
    fullCommand += 'python --version 2>&1 || echo "Python 版本获取失败"; ';
    fullCommand += 'python3 --version 2>&1 || echo "Python3 版本获取失败"; ';
    fullCommand += 'echo "=== 执行实际命令 ==="; ';
    
    // 最后添加要执行的命令
    fullCommand += `${command} ${args.join(' ')}`;
    
    // 使用 process.stdout.write 直接输出到控制台
    process.stdout.write(`\n[Server] 执行命令: ${fullCommand}\n`);
    process.stdout.write(`[Server] 工作目录: ${options.cwd || process.cwd()}\n`);
    //process.stdout.write(`[Server] PATH: ${env.PATH}\n`);
    
    const childProcess: ChildProcess = spawn('/bin/zsh', ['-l', '-c', fullCommand], {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      // 使用 process.stdout.write 直接输出到控制台
      //process.stdout.write(`[Server] ${output}`);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      // 使用 process.stderr.write 直接输出到控制台
      //process.stderr.write(`[Server] ${output}`);
    });

    childProcess.on('close', (code: number | null) => {
      resolve({ 
        stdout, 
        stderr, 
        success: code === 0,
        code 
      });
    });

    childProcess.on('error', (err) => {
      process.stderr.write(`[Server] 错误: ${err.message}\n`);
      resolve({ 
        stdout, 
        stderr, 
        success: false,
        code: null
      });
    });
  });
}

const server = new Server({
  name: "ninja-server",
  version: "1.0.0",
  timeout: 10000
}, {
  capabilities: {
    tools: {}
  }
});

// 定义可用工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "compile",
      description: "Compile WebView2 or Edge browser using autoninja",
      inputSchema: {
        type: "object",
        properties: {
          workDir: { 
            type: "string", 
            description: "Working directory, e.g. /Users/xu/edge3/src" 
          },
          buildPath: { 
            type: "string", 
            description: "Build output path, e.g. out/release_x64" 
          },
          target: { 
            type: "string", 
            description: "Build target, webview2 uses embedded_browser_webview, Edge uses chrome",
            enum: ["embedded_browser_webview", "chrome"]
          }
        },
        required: ["workDir", "buildPath", "target"]
      }
    }]
  };
});

// 启动服务器
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stdout.write("[Server] MCP 服务器已启动，等待客户端连接...\n");
}

startServer().catch(console.error);

// 处理工具执行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "compile") {
    let stdout = '';
    let stderr = '';
    try {
      const { workDir, buildPath, target } = request.params.arguments as { 
        workDir: string; 
        buildPath: string; 
        target: string 
      };
      
      // 先切换到工作目录
      const cdCommand = 'cd';
      const cdArgs = [workDir];
      const cdResult = await spawnPromise(cdCommand, cdArgs, {
        cwd: process.cwd(),
      });
      
      if (!cdResult.success) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to change directory:\n` +
                    `Target directory: ${workDir}\n` +
                    `Error: ${cdResult.stderr}\n` +
                    `Current directory: ${process.cwd()}`
            },
          ],
        };
      }
      
      // 执行编译命令
      const command = 'autoninja';
      const args = ['-C', buildPath, target];
      
      const result = await spawnPromise(command, args, {
        cwd: workDir,
      });
      stdout = result.stdout;
      stderr = result.stderr;

      // 返回执行结果，包含所有输出
      return {
        content: [
          {
            type: "text",
            text: `Build Details:\n` +
                  `Working Directory: ${workDir}\n` +
                  `Build Command: autoninja -C ${buildPath} ${target}\n` +
                  `Output:\n${stdout}\n` +
                  `Errors:\n${stderr}\n` +
                  `Status: ${result.success ? 'Success' : 'Failed'}\n` +
                  `Exit Code: ${result.code}\n` +
                  `${result.success ? 'Build completed' : 'Build failed'}`
          },
        ],
      };
    } catch (error) {
      // 处理错误，返回完整的错误信息
      const err = error as Error;
      const args = request.params.arguments as { 
        workDir: string; 
        buildPath: string; 
        target: string 
      } | undefined;
      return {
        content: [
          {
            type: "text", 
            text: `Build Failed:\n` +
                  `Working Directory: ${args?.workDir || 'Unknown directory'}\n` +
                  `Command: autoninja -C ${args?.buildPath || 'Unknown path'} ${args?.target || 'Unknown target'}\n` +
                  `Output:\n${stdout}\n` +
                  `Errors:\n${stderr}\n` +
                  `Error Message: ${err.message}\n` +
                  `Error Stack: ${err.stack || 'No stack trace'}`
          },
        ],
      };
    }
  }
  throw new Error("Tool not found");
});