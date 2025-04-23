import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Get command line arguments
const args = process.argv.slice(2);
const target = args[0] || "webview"; // Default to webview target

// Create client
const client = new Client({
  name: "ninja-client",
  version: "1.0.0"
});

// Connect to the running server
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"],
});

// Connect to server
async function connectToServer() {
  try {
    await client.connect(transport);
    console.log("Connected to MCP server");

    // Get available tools
    const tools = await client.listTools();
    console.log("Available tools:", tools);

    // Set build parameters
    const workDir = "/Users/xu/edge3/src"; // Working directory
    const buildPath = "out/release_x64"; // Build output directory (relative to workDir)
    const compileTarget = target === "webview" ? "embedded_browser_webview" : "chrome";

    // Execute build
    console.log(`Starting build for ${target}...`);
    console.log(`Working Directory: ${workDir}`);
    console.log(`Build Path: ${buildPath}`);
    console.log(`Build Target: ${compileTarget}`);
    
    const result = await client.callTool({
      name: "compile-webview2",
      arguments: {
        workDir,
        buildPath,
        target: compileTarget
      }
    });

    // Output build results
    if (result && result.content && Array.isArray(result.content) && result.content[0]) {
      console.log("\n=== Build Details ===");
      console.log(result.content[0].text);
      console.log("================\n");
    } else {
      console.log("Build completed, but no output was returned");
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// Start client
connectToServer().catch(console.error);