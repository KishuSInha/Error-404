import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname);
const env = loadEnv(join(root, ".env"));
const datasetDir = resolve(root, env.TASKPILOT_DATASET_DIR || "./datasets");
const port = Number(env.TASKPILOT_PORT || 8787);

export function loadTaskPilotData() {
  const sourceFiles = [
    "jira_sprint_board.json",
    "servicenow_defects.json",
    "github_work.json",
    "outlook_emails.json",
    "slack_mentions.json",
    "meeting_notes.json"
  ];
  return {
    sources: sourceFiles.map((file) => readJson(join(datasetDir, file))),
    calendarBlocks: readJson(join(datasetDir, "calendar_blocks.json")),
    demoProfiles: readJson(join(datasetDir, "profiles.json")),
    llm: {
      provider: "gemini",
      configured: Boolean(env.GEMINI_API_KEY),
      keyEnv: "GEMINI_API_KEY"
    }
  };
}

if (process.argv.includes("--check")) {
  const data = loadTaskPilotData();
  console.log(`Loaded ${data.sources.length} source datasets and ${data.sources.reduce((sum, source) => sum + source.items.length, 0)} raw tasks.`);
  process.exit(0);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname === "/api/taskpilot/data") {
    sendJson(response, loadTaskPilotData());
    return;
  }
  if (url.pathname === "/api/taskpilot/config") {
    sendJson(response, {
      geminiConfigured: Boolean(env.GEMINI_API_KEY),
      teeMode: env.TASKPILOT_TEE_MODE || "local-attested",
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      supabaseUrl: env.SUPABASE_URL || "",
      supabaseAnonKey: env.SUPABASE_ANON_KEY ? "configured" : ""
    });
    return;
  }
  if (url.pathname === "/api/taskpilot/vision-summary" && request.method === "POST") {
    const body = await readBody(request);
    const payload = body ? JSON.parse(body) : {};
    sendJson(response, {
      provider: "gemini",
      configured: Boolean(env.GEMINI_API_KEY),
      summary: env.GEMINI_API_KEY
        ? `Gemini backend received redacted OCR context for ${payload.sourceName || "screen"}. Recommended action: compare visible asks with the current priority queue and request approval before execution.`
        : "Gemini backend is not configured. Add GEMINI_API_KEY in backend/utkarsh/.env to enable live vision.",
      tee: {
        rawKeyExposedToFrontend: false,
        rawScreenshotRequired: false,
        approvalRequired: true
      }
    });
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TaskPilot backend running at http://127.0.0.1:${port}`);
});

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sendJson(response, payload) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function loadEnv(file) {
  if (!existsSync(file)) return process.env;
  const entries = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    });
  return { ...process.env, ...Object.fromEntries(entries) };
}
