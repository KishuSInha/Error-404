import { calendarBlocks, demoProfiles, sources } from "./data.js";
import { answerQuery, buildState, completeAndAssignNext, createExecutionBrief, createDailyPlan } from "./taskEngine.js";
import { createTeeSession, sealForTee, teePlanSteps } from "./teeTrust.js";
import "./styles.css";

const app = document.querySelector("#app");
const state = buildState(sources, calendarBlocks);
const isDesktopShell = Boolean(window.taskPilotDesktop?.isDesktop) || new URLSearchParams(window.location.search).has("desktop");

let activeProfile = "engineer";
let activeSource = "all";
let selectedTaskId = state.prioritized[0].id;
let completedTaskIds = [];
let authSession = JSON.parse(localStorage.getItem("taskpilot:session") || "null");
let backendConfig = { geminiConfigured: false, teeMode: "local-attested", supabaseConfigured: false, supabaseUrl: "" };
let authError = "";
let authLoading = false;
if (authSession?.role) activeProfile = authSession.role;
let lastAnswer = "Ask a quick question to see explainable agent output.";
let companionOpen = true;
let isProcessing = false;
let activeRunId = 0;
let currentPlanSteps = [];
let currentContext = null;
let teeSession = createTeeSession();
let dockEyesBound = false;
let companionLog = [
  {
    role: "agent",
    text: "TEE trust envelope is attested. I scanned Jira, ServiceNow, GitHub, Slack, Outlook, and meeting notes; the P1 upload issue is duplicated across 3 systems and has an ETA due today."
  }
];

function filteredTasks() {
  const queue = activeQueue();
  if (activeSource === "all") return queue;
  return queue.filter((task) => task.sources.some((source) => source.toLowerCase().includes(activeSource)));
}

function activeQueue() {
  return state.prioritized.filter((task) => !completedTaskIds.includes(task.id));
}

function sourceCounts() {
  return sources.map((source) => ({
    ...source,
    count: state.flattened.filter((task) => task.sourceId === source.id).length
  }));
}

function datasetInsights() {
  const unstructured = state.flattened.filter((task) => ["message", "note"].includes(task.type));
  const duplicateGroups = state.deduped.filter((task) => task.duplicateCount > 0);
  const owners = {};
  state.prioritized.forEach((task) => {
    const owner = task.owner || "Unassigned";
    if (!owners[owner]) owners[owner] = { owner, count: 0, score: 0, blockers: 0, p1: 0 };
    owners[owner].count += 1;
    owners[owner].score += task.score;
    owners[owner].blockers += task.dependencies.some((dep) => /block|waiting|approval|eta|coordinate/i.test(dep)) ? 1 : 0;
    owners[owner].p1 += task.severity === "P1" ? 1 : 0;
  });
  return {
    unstructuredCount: unstructured.length,
    duplicateGroups,
    ownerLoad: Object.values(owners).sort((a, b) => b.score - a.score),
    sourceTypes: [...new Set(sources.map((source) => source.type))],
    trainedSignals: state.model.samples,
    featureCount: state.model.features.length
  };
}

const navigationGroups = [
  {
    label: "Command",
    items: [
      ["Overview", "⌂"],
      ["Today priority", "◎"],
      ["Autonomous scan", "✦"]
    ]
  },
  {
    label: "Intelligence",
    items: [
      ["Unified inbox", "✉"],
      ["Meeting memory", "◷"],
      ["Hidden asks", "◇"]
    ]
  },
  {
    label: "Workspace",
    items: [
      ["Jira board", "▦"],
      ["Incidents", "△"],
      ["GitHub reviews", "⌁"]
    ]
  },
  {
    label: "Insights",
    items: [
      ["Analytics", "▥"],
      ["Execution plan", "✓"]
    ]
  }
];

function renderNavigation() {
  return navigationGroups
    .map(
      (group, groupIndex) => `
        <div class="nav-group">
          <p>${group.label}</p>
          ${group.items
            .map(
              ([label, icon], itemIndex) => `
                <button class="${groupIndex === 0 && itemIndex === 0 ? "active" : ""}" type="button">
                  <span>${icon}</span>
                  ${label}
                </button>
              `
            )
            .join("")}
        </div>
      `
    )
    .join("");
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-copy">
        <div class="login-logo">TP</div>
        <p class="eyebrow">TaskPilot AI</p>
        <h1>Your engineering work, ranked before the day starts.</h1>
        <p>TaskPilot brings Jira, Outlook, Slack, GitHub, ServiceNow, and meeting notes into one trusted execution queue. Pick your role and sign in with Google to continue.</p>
        <div class="login-preview">
          <div><strong>${state.deduped.length}</strong><span>ranked tasks</span></div>
          <div><strong>${state.alerts.length}</strong><span>urgent alerts</span></div>
          <div><strong>${Math.min(state.accuracy, 96)}%</strong><span>dedupe confidence</span></div>
        </div>
      </section>

      <section class="login-card">
        <p class="eyebrow">Secure workspace</p>
        <h2>Sign in to TaskPilot</h2>
        <p class="login-subtitle">Google authentication creates a workspace profile for your engineering role.</p>
        <div class="role-picker">
          <button class="${activeProfile === "engineer" ? "active" : ""}" data-login-role="engineer">Engineer</button>
          <button class="${activeProfile === "manager" ? "active" : ""}" data-login-role="manager">Manager</button>
        </div>
        <button class="google-login" id="googleLogin" ${authLoading ? "disabled" : ""}>
          <span>G</span>
          ${authLoading ? "Waiting for Google..." : "Continue with Google"}
        </button>
        ${authError ? `<p class="login-error">${authError}</p>` : ""}
        <p class="login-footnote">Private by design: screen OCR and final actions stay approval-gated through the TaskPilot desktop companion.</p>
      </section>
    </main>
  `;
  bindLoginEvents();
}

function render() {
  if (!authSession) {
    renderLogin();
    return;
  }
  const queue = activeQueue();
  const selected = queue.find((task) => task.id === selectedTaskId) || queue[0] || state.prioritized[0];
  const executionBrief = createExecutionBrief(selected);
  const dynamicPlan = createDailyPlan(queue, calendarBlocks);
  currentContext = detectContext(selected);
  app.innerHTML = `
    <main class="shell ${isDesktopShell ? "desktop-shell" : ""}">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">TP</div>
          <div>
            <strong>TaskPilot AI</strong>
            <span>${activeProfile === "manager" ? "Manager command" : "Engineer command"}</span>
          </div>
        </div>

        <nav class="app-nav" aria-label="Workspace navigation">
          ${renderNavigation()}
        </nav>

        <div class="profile-toggle role-switcher" role="tablist" aria-label="Profile">
          ${Object.keys(demoProfiles)
            .map(
              (key) => `
                <button class="${activeProfile === key ? "active" : ""}" data-profile="${key}">
                  ${key === "engineer" ? "Engineer" : "Manager"}
                </button>
              `
            )
            .join("")}
        </div>

        <section class="panel compact">
          <p class="eyebrow">${demoProfiles[activeProfile].name}</p>
          <h2>${demoProfiles[activeProfile].focus}</h2>
          <div class="metric-list">
            ${demoProfiles[activeProfile].metrics.map((metric) => `<span>${metric}</span>`).join("")}
          </div>
        </section>

        <p class="sidebar-label">Connected sources</p>
        <nav class="source-list" aria-label="Task sources">
          <button class="${activeSource === "all" ? "active" : ""}" data-source="all">
            <span class="source-dot all"></span>
            Unified inbox
            <strong>${state.flattened.length}</strong>
          </button>
          ${sourceCounts()
            .map(
              (source) => `
                <button class="${activeSource === source.id ? "active" : ""}" data-source="${source.id}">
                  <span class="source-dot" style="background:${source.color}"></span>
                  ${source.name}
                  <strong>${source.count}</strong>
                </button>
              `
            )
            .join("")}
        </nav>

        <section class="panel compact tee-card">
          <p class="eyebrow">Security</p>
          <h2>Trusted execution enabled</h2>
          <div class="tee-meter">
            <span style="width:${teeSession.trustScore}%"></span>
          </div>
          <p class="small">OCR and execution actions stay approval-gated.</p>
        </section>
      </aside>

      <section class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Friday, June 19, 2026</p>
            <h1>${activeProfile === "manager" ? "Team delivery dashboard" : "Engineer work queue"}</h1>
            <p class="topbar-subtitle">Signed in as ${escapeHtml(authSession.email)}. Live datasets combine Jira, Outlook, Slack, GitHub, ServiceNow, and meeting notes.</p>
          </div>
          <div class="top-actions">
            ${
              activeProfile === "manager"
                ? `<button class="secondary success" id="completePriority">Approve next handoff</button>`
                : `<button class="secondary success" id="completePriority">Complete & assign next</button>`
            }
            <button class="secondary" id="simulateUrgent">Simulate urgent work</button>
            <button class="primary" id="runScan">Run autonomous scan</button>
            <button class="secondary icon-action" id="logoutBtn">Sign out</button>
          </div>
        </header>

        ${activeProfile === "manager" ? managerHero(selected) : engineerHero(selected)}

        ${activeProfile === "manager" ? managerDashboard(selected) : engineerDashboard(selected, executionBrief, dynamicPlan)}
      </section>

    </main>
  `;
  bindEvents();
}

function engineerHero(selected) {
  const insights = datasetInsights();
  return `
    <section class="hero-grid engineer-hero">
      <article class="hero-card priority">
        <p class="eyebrow">Current execution task</p>
        <h2>${selected.canonicalTitle}</h2>
        <p>${selected.body}</p>
        <div class="score-row">
          <strong>${selected.score}</strong>
          <span>priority score</span>
          <span>${selected.severity}</span>
          <span>due ${formatDue(selected.due)}</span>
        </div>
      </article>
      <article class="hero-card">
        <p class="eyebrow">NLP extraction</p>
        <h2>${insights.unstructuredCount} hidden asks found</h2>
        <p>Email, Slack, and meeting-note text was converted into structured owner, due date, severity, and execution steps.</p>
      </article>
      <article class="hero-card alert">
        <p class="eyebrow">Duplicate removal</p>
        <h2>${insights.duplicateGroups.length} merge groups</h2>
        <p>${insights.duplicateGroups[0]?.canonicalTitle || "No duplicate work detected"} is linked across ${insights.duplicateGroups[0]?.sources.length || 0} systems.</p>
      </article>
      <article class="hero-card trust">
        <p class="eyebrow">Trusted execution</p>
        <h2>Approval-first agent</h2>
        <p>TaskPilot guides implementation, scan, reply, and closeout steps while final execution stays user-approved.</p>
      </article>
    </section>
  `;
}

function managerHero(selected) {
  const insights = datasetInsights();
  const blockers = state.prioritized.filter((task) => task.dependencies.some((dep) => /block|waiting|approval|eta|coordinate/i.test(dep)));
  const slaRisks = state.prioritized.filter((task) => task.severity === "P1" || task.due <= "2026-06-20");
  return `
    <section class="manager-command-strip">
      <article class="command-card risk">
        <p class="eyebrow">Team risk pulse</p>
        <h2>${slaRisks.length} SLA / escalation risks</h2>
        <p>Highest risk: ${selected.canonicalTitle}. It is correlated across ${selected.sources.length} systems and requires manager visibility.</p>
      </article>
      <article class="command-card">
        <p class="eyebrow">Dataset intelligence</p>
        <h2>${state.flattened.length} raw signals → ${state.deduped.length} clean tasks</h2>
        <p>Trained on ${insights.trainedSignals} backend records using ${insights.featureCount} features: source type, severity, deadline, owner pressure, blockers, impact, and duplicate similarity.</p>
      </article>
      <article class="command-card">
        <p class="eyebrow">NLP pipeline</p>
        <h2>${insights.unstructuredCount} unstructured asks</h2>
        <p>Emails, Slack mentions, and meeting notes are normalized into structured task records before priority scoring.</p>
      </article>
      <article class="command-card blocker">
        <p class="eyebrow">Manager action</p>
        <h2>${blockers.length} blockers need decisions</h2>
        <p>Use this view to rebalance owners, approve dependencies, and send ETA updates across Jira, ServiceNow, and Outlook.</p>
      </article>
    </section>
  `;
}

function engineerDashboard(selected, executionBrief, dynamicPlan) {
  return `
    <section class="content-grid engineer-dashboard">
      <div class="board">
        <div class="section-head">
          <div>
            <p class="eyebrow">Unified task board</p>
            <h2>Deduped and ranked work</h2>
          </div>
          <span>${filteredTasks().length} visible</span>
        </div>
        <div class="task-list">
          ${filteredTasks().map(taskCard).join("")}
        </div>
      </div>

      <aside class="details">
        <section class="panel">
          <p class="eyebrow">Why this rank?</p>
          <h2>${selected.canonicalTitle}</h2>
          <ul class="reason-list">
            ${selected.rankReasons.map((reason) => `<li>${reason}</li>`).join("")}
          </ul>
          <div class="tag-row">
            ${selected.sources.map((source) => `<span>${source}</span>`).join("")}
          </div>
        </section>

        <section class="panel execution-panel">
          <p class="eyebrow">Execution brief</p>
          <h2>${executionBrief.title}</h2>
          <p class="definition">${executionBrief.definitionOfDone}</p>
          <div class="timeline-pill">Timeline: ${executionBrief.timeline}</div>
          <ol class="process-list">
            ${executionBrief.process.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ol>
          <p class="small">${executionBrief.approvalGate}</p>
        </section>

        <section class="panel">
          <p class="eyebrow">Today’s plan</p>
          <div class="timeline">
            ${renderTimeline(dynamicPlan)}
          </div>
        </section>

        <section class="panel">
          <p class="eyebrow">Ask TaskPilot</p>
          ${renderQuickQueries()}
          <div class="answer" id="answerBox">${lastAnswer}</div>
        </section>
      </aside>
    </section>
  `;
}

function managerDashboard(selected) {
  const insights = datasetInsights();
  const p1Tasks = state.prioritized.filter((task) => task.severity === "P1");
  const blockers = state.prioritized.filter((task) => task.dependencies.some((dep) => /block|waiting|approval|eta/i.test(dep)));
  const duplicateTasks = insights.duplicateGroups;
  const sourceRows = sourceCounts()
    .map(
      (source) => `
        <div class="manager-source-row">
          <span class="source-dot" style="background:${source.color}"></span>
          <strong>${source.name}</strong>
          <span>${source.count} signals</span>
        </div>
      `
    )
    .join("");
  return `
    <section class="manager-dashboard">
      <div class="manager-grid">
        <article class="manager-card focus team-brief">
          <p class="eyebrow">Standup brief</p>
          <h2>Today’s delivery risks</h2>
          <ul class="manager-brief-list">
            <li><strong>${selected.owner || "Owner"}</strong> owns the highest escalation: ${selected.canonicalTitle}.</li>
            <li><strong>${blockers.length} blockers</strong> need dependency or approval decisions.</li>
            <li><strong>${duplicateTasks.length} duplicate groups</strong> were merged before team planning.</li>
          </ul>
        </article>

        <article class="manager-card">
          <p class="eyebrow">Team health</p>
          <div class="stat-stack">
            <div><strong>${p1Tasks.length}</strong><span>P1 risks</span></div>
            <div><strong>${blockers.length}</strong><span>blockers</span></div>
            <div><strong>${state.deduped.length}</strong><span>clean tasks</span></div>
          </div>
        </article>

        <article class="manager-card">
          <p class="eyebrow">Workload from datasets</p>
          <div class="workload-bars">
            ${insights.ownerLoad
              .slice(0, 5)
              .map((owner, index) => [owner.owner, Math.min(96, Math.max(18, owner.score)), ["#0c66e4", "#22a06b", "#ffab00", "#6554c0", "#de350b"][index % 5], owner])
              .map(
                ([name, load, color, owner]) => `
                  <div>
                    <span>${name}<strong>${owner.count} tasks · ${owner.blockers} blockers</strong></span>
                    <i><b style="width:${load}%;background:${color}"></b></i>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </div>

      <section class="manager-lanes">
        <div class="board manager-board">
          <div class="section-head">
            <div>
              <p class="eyebrow">Priority lanes</p>
              <h2>Team execution queue</h2>
            </div>
            <span>${state.prioritized.length} active</span>
          </div>
          <div class="lane-grid">
            ${["P1", "P2", "P3"].map((severity) => renderManagerLane(severity)).join("")}
          </div>
        </div>

        <aside class="details">
          <section class="panel">
            <p class="eyebrow">Source intelligence</p>
            <h2>Signals by system</h2>
            <div class="manager-source-list">${sourceRows}</div>
          </section>

          <section class="panel execution-panel">
            <p class="eyebrow">Decision brief</p>
            <h2>${selected.canonicalTitle}</h2>
            <ul class="reason-list">
              ${selected.rankReasons.map((reason) => `<li>${reason}</li>`).join("")}
            </ul>
            <p class="small">Recommended manager action: confirm owner, unblock dependencies, and send ETA update before the next customer checkpoint.</p>
          </section>

          <section class="panel model-panel">
            <p class="eyebrow">Priority model</p>
            <h2>Live scoring features</h2>
            <div class="model-feature-grid">
              ${state.model.features
                .map((feature) => [feature, modelFeatureDescription(feature)])
                .map(([label, detail]) => `<div><strong>${label}</strong><span>${detail}</span></div>`)
                .join("")}
            </div>
          </section>

          <section class="panel">
            <p class="eyebrow">Ask TaskPilot</p>
            ${renderQuickQueries()}
            <div class="answer" id="answerBox">${lastAnswer}</div>
          </section>
        </aside>
      </section>
    </section>
  `;
}

function modelFeatureDescription(feature) {
  const descriptions = {
    severity: "P1/P2/P3 signal weight",
    deadline: "due date urgency window",
    businessImpact: "business impact from source",
    dependencyRisk: "blocker and approval risk",
    duplicateSimilarity: "ID and NLP phrase overlap",
    sourceType: "tracker vs unstructured text",
    ownerPressure: "workload from assigned tasks",
    nlpExtraction: "hidden action-item detection"
  };
  return descriptions[feature] || "trained dataset signal";
}

function renderManagerLane(severity) {
  const laneTasks = state.prioritized.filter((task) => task.severity === severity).slice(0, 4);
  return `
    <div class="priority-lane">
      <div class="lane-head">
        <strong>${severity}</strong>
        <span>${laneTasks.length}</span>
      </div>
      ${laneTasks.map((task) => `<button class="lane-card ${selectedTaskId === task.id ? "selected" : ""}" data-task="${task.id}"><strong>${task.canonicalTitle}</strong><span>${task.sources.join(" · ")}</span></button>`).join("")}
    </div>
  `;
}

function renderTimeline(dynamicPlan) {
  return dynamicPlan
    .map(
      (slot) => `
        <div class="slot">
          <time>${slot.time}</time>
          <div>
            <strong>${slot.label}</strong>
            <span>${slot.task ? slot.task.canonicalTitle : "Buffer"}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderQuickQueries() {
  return `
    <div class="quick-queries">
      ${["What’s my top priority?", "Summarize my emails", "Show duplicate tasks", "What is blocking teammates?", "Prepare manager standup"]
        .map((query) => `<button data-query="${escapeHtml(query)}">${query}</button>`)
        .join("")}
    </div>
  `;
}

function taskCard(task) {
  return `
    <button class="task-card ${selectedTaskId === task.id ? "selected" : ""}" data-task="${task.id}">
      <div class="task-main">
        <span class="severity ${task.severity.toLowerCase()}">${task.severity}</span>
        <div>
          <strong>${task.canonicalTitle}</strong>
          <p>${task.extraction} • ${task.aliases.join(", ")}</p>
        </div>
      </div>
      <div class="task-meta">
        <span>${task.score}</span>
        <small>${task.sources.length} source${task.sources.length > 1 ? "s" : ""}</small>
      </div>
    </button>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      activeProfile = button.dataset.profile;
      authSession = { ...authSession, role: activeProfile };
      localStorage.setItem("taskpilot:session", JSON.stringify(authSession));
      render();
    });
  });

  document.querySelectorAll("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSource = button.dataset.source;
      render();
    });
  });

  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTaskId = button.dataset.task;
      render();
    });
  });

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const answer = answerQuery(button.dataset.query, state);
      lastAnswer = answer;
      pushCompanion("user", button.dataset.query, false);
      pushCompanion("agent", answer, false);
      render();
    });
  });

  document.querySelector("#runScan").addEventListener("click", () => {
    runCompanionWorkflow("Run autonomous scan across all sources");
  });

  document.querySelector("#logoutBtn").addEventListener("click", () => {
    authSession = null;
    completedTaskIds = [];
    localStorage.removeItem("taskpilot:session");
    render();
  });

  document.querySelector("#completePriority").addEventListener("click", () => {
    const queue = activeQueue();
    const current = queue.find((task) => task.id === selectedTaskId) || queue[0];
    const assignment = completeAndAssignNext(queue, current.id);
    completedTaskIds = [...completedTaskIds, current.id];
    selectedTaskId = assignment.next?.id || activeQueue()[0]?.id || current.id;
    pushCompanion("agent", `${assignment.handoff.message} ${assignment.handoff.brief ? `Why: ${assignment.handoff.brief.whyNow.slice(0, 2).join("; ")}. Timeline: ${assignment.handoff.brief.timeline}.` : ""}`, false);
    lastAnswer = assignment.handoff.brief
      ? `${assignment.handoff.message} Definition: ${assignment.handoff.brief.definitionOfDone}`
      : assignment.handoff.message;
    render();
  });

  document.querySelector("#simulateUrgent").addEventListener("click", () => {
    pushCompanion("agent", "New urgent signal detected: VP ETA email keeps CSV upload as #1 and recommends a reply before 4 PM.");
  });

  document.querySelector("#dockToggle")?.addEventListener("click", () => {
    companionOpen = !companionOpen;
    render();
  });

  document.querySelector("#minimizeCompanion")?.addEventListener("click", () => {
    companionOpen = false;
    render();
  });

  document.querySelector("#closeCompanion")?.addEventListener("click", () => {
    companionOpen = false;
    render();
  });

  document.querySelector("#captureScreen")?.addEventListener("click", () => {
    runCompanionWorkflow("Secure OCR scan", { captureScreen: true });
  });

  document.querySelectorAll("[data-companion-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.companionQuery;
      runCompanionWorkflow(query, { captureScreen: /ocr|scan|screen/i.test(query) });
    });
  });

  document.querySelector("#taskInput")?.addEventListener("input", (event) => {
    autoResize(event.target);
  });

  document.querySelector("#taskInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isProcessing) {
        stopProcessing();
      } else {
        document.querySelector("#companionForm")?.requestSubmit();
      }
    }
    if (event.key === "Escape") {
      companionOpen = false;
      render();
    }
  });

  document.querySelector("#companionForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isProcessing) {
      stopProcessing();
      return;
    }
    const input = new FormData(event.target).get("message").trim();
    if (!input) return;
    runCompanionWorkflow(input, { captureScreen: /ocr|scan|screen/i.test(input) });
  });

  if (!dockEyesBound) {
    document.addEventListener("mousemove", updateDockEyes, { passive: true });
    dockEyesBound = true;
  }
}

function bindLoginEvents() {
  document.querySelectorAll("[data-login-role]").forEach((button) => {
    button.addEventListener("click", () => {
      activeProfile = button.dataset.loginRole;
      renderLogin();
    });
  });

  document.querySelector("#googleLogin").addEventListener("click", async () => {
    authError = "";
    authLoading = true;
    renderLogin();

    if (backendConfig.supabaseConfigured && window.taskPilotDesktop?.googleLogin) {
      const result = await window.taskPilotDesktop.googleLogin(activeProfile);
      if (!result.success) {
        authError = result.error || "Google sign-in failed.";
        authLoading = false;
        renderLogin();
        return;
      }
      authSession = result.session;
    } else {
      authSession = {
        provider: "demo",
        role: activeProfile,
        email: activeProfile === "manager" ? "manager@taskpilot.dev" : "engineer@taskpilot.dev",
        name: activeProfile === "manager" ? "Engineering Manager" : "Software Engineer"
      };
    }

    authLoading = false;
    localStorage.setItem("taskpilot:session", JSON.stringify(authSession));
    render();
  });
}

function pushCompanion(role, text, rerender = true) {
  companionLog = [...companionLog, { role, text }].slice(-6);
  if (rerender) render();
}

async function runCompanionWorkflow(intent, options = {}) {
  if (isProcessing) return;
  companionOpen = true;
  isProcessing = true;
  activeRunId += 1;
  const runId = activeRunId;
  const selected = state.prioritized.find((task) => task.id === selectedTaskId) || state.prioritized[0];
  const queue = activeQueue();
  const current = queue.find((task) => task.id === selectedTaskId) || queue[0] || selected;
  const sealed = sealForTee(
    {
      intent,
      activeApp: currentContext?.app?.name,
      selectedTask: current.canonicalTitle,
      sourceCount: state.flattened.length,
      containsScreenFrame: Boolean(options.captureScreen)
    },
    teeSession
  );

  currentPlanSteps = teePlanSteps(intent).map((step) => ({ ...step, status: "pending" }));
  pushCompanion("user", intent, false);
  render();

  try {
    await runStep(runId, "context", "running", "Detecting active app and selected task");
    await sleep(220);
    await runStep(runId, "context", "done", `${contextLabel(currentContext)} detected`);

    await runStep(runId, "tee", "running", "Sealing minimized payload inside TEE envelope");
    await sleep(260);
    await runStep(runId, "tee", "done", `Sealed payload ${sealed.payloadDigest}`);

    await runStep(runId, "reason", "running", "Ranking urgency, deadline, blockers, and duplicate signals");
    const result = options.captureScreen ? await runScreenScan(runId, sealed) : createCompanionAnswer(intent, sealed);
    await runStep(runId, "reason", "done", "Reasoning complete with auditable rationale");

    await runStep(runId, "consent", "running", "Preparing user-approved recommendation");
    await sleep(180);
    await runStep(runId, "consent", "done", "No execution performed without approval");

    if (runId !== activeRunId) return;
    lastAnswer = result;
    pushCompanion("agent", result, false);
  } catch (error) {
    if (runId === activeRunId) {
      pushCompanion("agent", `Workflow stopped safely: ${error.message}`, false);
    }
  } finally {
    if (runId === activeRunId) {
      isProcessing = false;
      render();
    }
  }
}

async function runScreenScan(runId, sealed) {
  if (window.taskPilotDesktop?.captureScreen) {
    const capture = await window.taskPilotDesktop.captureScreen({
      attestationHash: teeSession.attestationHash,
      payloadDigest: sealed.payloadDigest
    });
    if (runId !== activeRunId) throw new Error("scan cancelled");
    if (backendConfig.geminiConfigured && capture.thumbnail) {
      return analyzeScreenWithGemini(capture.thumbnail, capture.name);
    }
    return `TEE OCR demo scan complete for ${capture.name}. The frame was treated as ephemeral, sealed as ${sealed.payloadDigest}, and mapped to the CSV upload incident without sending raw screen data.`;
  }
  await sleep(360);
  return `Browser demo TEE OCR complete. I would capture the visible screen only after approval, seal it as ${sealed.payloadDigest}, extract visible asks, and keep execution under your control.`;
}

function createCompanionAnswer(intent, sealed) {
  const normalized = intent.toLowerCase();
  if (normalized.includes("what should") || normalized.includes("now")) {
    const top = activeQueue()[0] || state.prioritized[0];
    return `Do ${top.canonicalTitle} first. It is due today, has ${top.severity} severity, and appears across ${top.sources.length} sources. TEE payload: ${sealed.payloadDigest}.`;
  }
  if (normalized.includes("autonomous scan")) {
    return `Autonomous scan complete: ${state.flattened.length} raw signals checked, ${state.deduped.length} clean tasks produced, hidden email work extracted, and duplicate work merged. TEE payload: ${sealed.payloadDigest}.`;
  }
  if (normalized.includes("secure ocr") || normalized.includes("ocr") || normalized.includes("screen")) {
    return `TEE OCR is ready. Press TEE OCR to capture the screen with an ephemeral frame, secret redaction, and approval-first execution.`;
  }
  if (normalized.includes("duplicate") || normalized.includes("email") || normalized.includes("top") || normalized.includes("priority") || normalized.includes("block") || normalized.includes("manager")) {
    return `${answerQuery(intent, state)} TEE payload: ${sealed.payloadDigest}.`;
  }
  return `${answerQuery(intent, state)} TEE payload: ${sealed.payloadDigest}.`;
}

async function runStep(runId, id, status, label) {
  if (runId !== activeRunId) throw new Error("run cancelled");
  currentPlanSteps = currentPlanSteps.map((step) => (step.id === id ? { ...step, status, label } : step));
  render();
}

function stopProcessing() {
  activeRunId += 1;
  isProcessing = false;
  currentPlanSteps = currentPlanSteps.map((step) => (step.status === "running" ? { ...step, status: "error", label: "Stopped by user" } : step));
  pushCompanion("agent", "Stopped safely. No external call or task execution continued after your stop request.");
}

function autoResize(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

function detectContext(selected) {
  const primarySource = activeSource === "all" ? selected.sources[0] : sources.find((source) => source.id === activeSource)?.name;
  return {
    app: { name: primarySource || "TaskPilot" },
    task: selected.canonicalTitle,
    profile: demoProfiles[activeProfile].name,
    trust: teeSession.status
  };
}

function contextLabel(context) {
  if (!context?.app?.name) return "Ready";
  return `${context.app.name} - ${context.profile}`;
}

function stepIcon(status) {
  if (status === "running") return "...";
  if (status === "done") return "OK";
  if (status === "error") return "!";
  return "o";
}

function renderLogText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function updateDockEyes(event) {
  const dock = document.querySelector(".dock-avatar");
  if (!dock) return;
  const rect = dock.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
  const move = Math.min(2.8, Math.hypot(event.clientX - centerX, event.clientY - centerY) / 80);
  const x = Math.cos(angle) * move;
  const y = Math.sin(angle) * move;
  document.querySelectorAll(".dock-eye").forEach((eye) => {
    eye.style.transform = `translate(${x}px, ${y}px)`;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeScreenWithGemini(dataUrl, sourceName) {
  try {
    const visionRequest = {
      sourceName,
      redactedOcrContext: "screen frame sealed by TEE; frontend does not receive Gemini key",
      hasFrame: Boolean(dataUrl)
    };
    if (window.taskPilotDesktop?.summarizeVision) {
      const result = await window.taskPilotDesktop.summarizeVision(visionRequest);
      return result.summary;
    }
    const response = await fetch("http://127.0.0.1:8787/api/taskpilot/vision-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visionRequest)
    });
    const visionPayload = await response.json();
    return visionPayload.summary;
  } catch (error) {
    return `Backend Gemini service was unavailable, so I kept local prioritization active. ${error.message}`;
  }
}

function formatDue(date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadBackendConfig() {
  try {
    if (window.taskPilotDesktop?.getBackendConfig) {
      backendConfig = await window.taskPilotDesktop.getBackendConfig();
    } else {
      const response = await fetch("http://127.0.0.1:8787/api/taskpilot/config");
      backendConfig = await response.json();
    }
  } catch {
    backendConfig = { geminiConfigured: false, teeMode: "local-attested", supabaseConfigured: false, supabaseUrl: "" };
  }

  const isLegacySession =
    backendConfig.supabaseConfigured &&
    authSession &&
    (authSession.provider === "demo" || (authSession.provider === "google-supabase" && !authSession.userId));
  if (isLegacySession) {
    authSession = null;
    localStorage.removeItem("taskpilot:session");
  }
}

loadBackendConfig().finally(render);
