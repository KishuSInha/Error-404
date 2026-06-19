import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const frontendRoot = resolve(".");
const backendRoot = resolve(frontendRoot, "../../backend/utkarsh");
const datasetDir = join(backendRoot, "datasets");
const sourceFiles = [
  "jira_sprint_board.json",
  "servicenow_defects.json",
  "github_work.json",
  "outlook_emails.json",
  "slack_mentions.json",
  "meeting_notes.json"
];

const data = {
  sources: sourceFiles.map((file) => readJson(join(datasetDir, file))),
  calendarBlocks: readJson(join(datasetDir, "calendar_blocks.json")),
  demoProfiles: readJson(join(datasetDir, "profiles.json"))
};

writeFileSync(
  join(frontendRoot, "src/generated/backendData.js"),
  `export const backendData = ${JSON.stringify(data, null, 2)};\n`
);
console.log(`Synced ${data.sources.length} backend datasets into frontend generated data.`);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
