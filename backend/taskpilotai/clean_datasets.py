"""
TaskPilot AI — Full NLP Data Pipeline
Steps: Ingest → Standardize → Clean → NLP → Entity Extraction →
       Hidden Task Detection → Semantic Dedup → Dependency Graph →
       Feature Engineering → Priority Scoring → Daily Plan → Save

Install deps:
  pip install pandas numpy spacy sentence-transformers scikit-learn rapidfuzz networkx dateparser
  python -m spacy download en_core_web_sm
"""

import re
import json
import os
import warnings
import pandas as pd
import numpy as np
from pathlib import Path

warnings.filterwarnings("ignore")

DATA_DIR = Path(os.path.dirname(os.path.abspath(__file__))) / "datasets"

# ─── Step 1: Multi-Source Data Ingestion ─────────────────────────────────────

def load_json_df(path):
    """Load a JSON file that may have { items: [...] } or be a raw array."""
    with open(path) as f:
        raw = json.load(f)
    if isinstance(raw, dict) and "items" in raw:
        return pd.DataFrame(raw["items"])
    elif isinstance(raw, list):
        return pd.DataFrame(raw)
    else:
        return pd.DataFrame([raw])

print("\n" + "="*60)
print("🚀 TaskPilot AI — NLP Data Pipeline")
print("="*60 + "\n")

print("[1/12] Loading source datasets...")
github     = load_json_df(DATA_DIR / "github_work.json")
jira       = load_json_df(DATA_DIR / "jira_sprint_board.json")
slack      = load_json_df(DATA_DIR / "slack_mentions.json")
servicenow = load_json_df(DATA_DIR / "servicenow_defects.json")
calendar   = load_json_df(DATA_DIR / "calendar_blocks.json")
try:
    emails = load_json_df(DATA_DIR / "outlook_emails.json")
except Exception:
    emails = pd.DataFrame()
try:
    meetings = load_json_df(DATA_DIR / "meeting_notes.json")
except Exception:
    meetings = pd.DataFrame()

print(f"   Loaded: github={len(github)}, jira={len(jira)}, slack={len(slack)}, servicenow={len(servicenow)}")

# ─── Step 2: Standardize Schema ──────────────────────────────────────────────

COMMON_COLUMNS = ["source", "task_id", "title", "description", "owner",
                  "team", "severity", "status", "due_date"]

def standardize(df, source):
    if df is None or df.empty:
        return pd.DataFrame(columns=COMMON_COLUMNS)
    col_map = {"id": "task_id", "body": "description", "due": "due_date"}
    df = df.rename(columns=col_map)
    for col in COMMON_COLUMNS:
        if col not in df.columns:
            df[col] = None
    df["source"] = source
    # Ensure task_id is string
    if "task_id" in df.columns:
        df["task_id"] = df["task_id"].astype(str)
    return df[COMMON_COLUMNS]

print("[2/12] Standardizing schemas...")
github_std     = standardize(github.copy(),     "github")
jira_std       = standardize(jira.copy(),       "jira")
slack_std      = standardize(slack.copy(),      "slack")
servicenow_std = standardize(servicenow.copy(), "servicenow")
emails_std     = standardize(emails.copy(),     "email") if not emails.empty else pd.DataFrame(columns=COMMON_COLUMNS)

tasks = pd.concat([github_std, jira_std, slack_std, servicenow_std, emails_std],
                  ignore_index=True)

# ─── Step 3: Data Cleaning ────────────────────────────────────────────────────

print("[3/12] Cleaning data...")
tasks = tasks.drop_duplicates()
tasks = tasks.drop_duplicates(subset=["task_id"])
tasks["owner"]    = tasks["owner"].fillna("Unassigned")
tasks["severity"] = tasks["severity"].fillna("P3").astype(str).str.upper()

severity_map = {
    "CRITICAL": "P1", "SEV-1": "P1", "SEV-2": "P2", "SEV-3": "P3",
    "HIGH": "P1", "MEDIUM": "P2", "LOW": "P3", "1": "P1", "2": "P2", "3": "P3"
}
tasks["severity"] = tasks["severity"].replace(severity_map)

# Normalize to P1-P4
def normalize_severity(s):
    s = str(s).upper()
    if s in ("P1", "CRITICAL", "SEV-1"): return "P1"
    if s in ("P2", "HIGH", "SEV-2"):     return "P2"
    if s in ("P3", "MEDIUM", "SEV-3"):   return "P3"
    return "P4"

tasks["severity"] = tasks["severity"].apply(normalize_severity)
tasks["due_date"] = pd.to_datetime(tasks["due_date"], errors="coerce")
tasks["title"]       = tasks["title"].fillna("").astype(str).str.strip()
tasks["description"] = tasks["description"].fillna("").astype(str).str.strip()

# ─── Step 4: Text Preprocessing ──────────────────────────────────────────────

print("[4/12] Running NLP text preprocessing (spaCy)...")
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_OK = True
except Exception as e:
    print(f"   ⚠ spaCy unavailable ({e}), using simple tokenizer")
    SPACY_OK = False

def preprocess(text):
    if not text or pd.isna(text):
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    if SPACY_OK:
        doc = nlp(text)
        tokens = [tok.lemma_ for tok in doc if not tok.is_stop and not tok.is_punct and len(tok.lemma_) > 1]
    else:
        tokens = [w for w in text.split() if len(w) > 2]
    return " ".join(tokens)

tasks["clean_text"] = (
    tasks["title"].fillna("") + " " + tasks["description"].fillna("")
).apply(preprocess)

# ─── Step 5: NLP Entity Extraction ───────────────────────────────────────────

print("[5/12] Extracting entities (people, dates, issue IDs)...")
try:
    import dateparser
    DATEPARSER_OK = True
except ImportError:
    DATEPARSER_OK = False

def extract_entities(text):
    entities = {"people": [], "dates": [], "issue_ids": []}
    if not text or not SPACY_OK:
        return entities
    doc = nlp(str(text))
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            entities["people"].append(ent.text)
        elif ent.label_ == "DATE" and DATEPARSER_OK:
            parsed = dateparser.parse(ent.text)
            if parsed:
                entities["dates"].append(parsed.date().isoformat())
    ids = re.findall(r"(INC-\d+|JIRA-\d+|PR-\d+|GH-\d+|SLACK-\d+)", str(text), re.IGNORECASE)
    entities["issue_ids"] = ids
    return entities

tasks["entities"] = tasks["description"].fillna("").apply(extract_entities)

# ─── Step 6: Hidden Task Detection ───────────────────────────────────────────

print("[6/12] Detecting hidden tasks from unstructured signals...")
URGENT_WORDS = ["urgent", "asap", "blocked", "critical", "immediately", "sla", "escalation",
                "please", "action required", "deadline", "review", "approve"]

def detect_hidden_task(text):
    text = str(text).lower()
    return any(word in text for word in URGENT_WORDS)

tasks["hidden_task_signal"] = tasks["description"].fillna("").apply(detect_hidden_task)
print(f"   Found {tasks['hidden_task_signal'].sum()} hidden task signals")

# ─── Step 7: Semantic Deduplication ──────────────────────────────────────────

print("[7/12] Running semantic deduplication with sentence-transformers...")
duplicates_df = pd.DataFrame(columns=["task_1", "task_2", "score"])

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity

    model = SentenceTransformer("all-MiniLM-L6-v2")
    texts = tasks["clean_text"].tolist()
    if texts:
        embeddings = model.encode(texts, show_progress_bar=False)
        similarity = cosine_similarity(embeddings)

        THRESHOLD = 0.85
        duplicates = []
        n = len(tasks)
        for i in range(n):
            for j in range(i + 1, n):
                if similarity[i][j] >= THRESHOLD:
                    duplicates.append({
                        "task_1": tasks.iloc[i]["task_id"],
                        "task_2": tasks.iloc[j]["task_id"],
                        "score":  round(float(similarity[i][j]), 3)
                    })
        duplicates_df = pd.DataFrame(duplicates)
        print(f"   Found {len(duplicates_df)} duplicate pairs (threshold={THRESHOLD})")
    else:
        print("   No tasks to deduplicate")
except Exception as e:
    print(f"   ⚠ Sentence-transformers unavailable ({e}), skipping semantic dedup")

# ─── Step 8: Dependency Graph ─────────────────────────────────────────────────

print("[8/12] Building dependency graph with networkx...")
try:
    import networkx as nx
    graph = nx.Graph()
    for _, row in tasks.iterrows():
        graph.add_node(row["task_id"], owner=row["owner"], severity=row["severity"])
    for _, row in duplicates_df.iterrows():
        graph.add_edge(row["task_1"], row["task_2"], weight=row["score"])
    print(f"   Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
except Exception as e:
    print(f"   ⚠ networkx unavailable ({e}), skipping graph")

# ─── Step 9: Feature Engineering ─────────────────────────────────────────────

print("[9/12] Engineering priority features...")
today = pd.Timestamp.today()

severity_score_map = {"P1": 10, "P2": 7, "P3": 4, "P4": 1}
tasks["severity_score"] = tasks["severity"].map(severity_score_map).fillna(1)

tasks["days_to_due"] = (tasks["due_date"] - today).dt.days
tasks["days_to_due"] = tasks["days_to_due"].fillna(30).clip(-30, 90)

tasks["workload_score"] = tasks.groupby("owner")["task_id"].transform("count")
tasks["urgency_score"]  = tasks["hidden_task_signal"].astype(int)

# ─── Step 10: Priority Scoring ────────────────────────────────────────────────

print("[10/12] Computing priority scores...")
tasks["priority_score"] = (
    tasks["severity_score"] * 0.40 +
    (30 - tasks["days_to_due"]).clip(0, 30) * 0.30 +
    tasks["workload_score"] * 0.20 +
    tasks["urgency_score"] * 10 * 0.10
).round(2)

tasks = tasks.sort_values("priority_score", ascending=False).reset_index(drop=True)

# ─── Step 11: Daily Plan Generation ──────────────────────────────────────────

print("[11/12] Generating top-5 daily plan...")
top_tasks = tasks.head(5)
print("\n  === TODAY'S PRIORITY PLAN ===")
for _, row in top_tasks.iterrows():
    print(f"\n  Task:     {row['title']}")
    print(f"  Owner:    {row['owner']}")
    print(f"  Score:    {row['priority_score']}")
    print(f"  Severity: {row['severity']}")
    print(f"  Due:      {row['due_date']}")
    print(f"  Source:   {row['source']}")
print()

# ─── Step 12: Query Helpers ────────────────────────────────────────────────────

def top_priority():
    task = tasks.iloc[0]
    return {"title": task["title"], "owner": task["owner"], "priority_score": task["priority_score"]}

def blocked_tasks():
    return tasks[tasks["clean_text"].str.contains("blocked", case=False, na=False)][["task_id", "title"]]

def overloaded_engineers():
    return tasks.groupby("owner").size().sort_values(ascending=False)

# ─── Save Final Datasets ──────────────────────────────────────────────────────

print("[12/12] Saving processed datasets...")

# Convert entities column to JSON-serializable dict
tasks_out = tasks.copy()
tasks_out["entities"]     = tasks_out["entities"].apply(lambda x: x if isinstance(x, dict) else {})
tasks_out["due_date"]     = tasks_out["due_date"].astype(str).replace("NaT", None)

# Group by source for cleaned_tasks.json (matches agentOrchestrator.mjs expectations)
cleaned = {}
for src in tasks_out["source"].unique():
    subset = tasks_out[tasks_out["source"] == src].copy()
    # Rename columns back to what the Node.js orchestrator expects
    subset = subset.rename(columns={
        "task_id":       "id",
        "description":  "body",
        "due_date":     "due",
        "workload_score":"workload"
    })
    cleaned[src] = json.loads(subset.to_json(orient="records"))

output_file = DATA_DIR / "cleaned_tasks.json"
with open(output_file, "w") as f:
    json.dump(cleaned, f, indent=2, default=str)

# Also save full processed data for reference
full_output = DATA_DIR / "taskpilot_processed.json"
with open(full_output, "w") as f:
    json.dump(json.loads(tasks_out.to_json(orient="records")), f, indent=2, default=str)

# Save duplicates
dup_output = DATA_DIR / "duplicate_tasks.json"
with open(dup_output, "w") as f:
    json.dump(json.loads(duplicates_df.to_json(orient="records")), f, indent=2, default=str)

print("\n" + "="*60)
print("✅ Pipeline Complete!")
print(f"   Total tasks processed: {len(tasks)}")
for src, rows in cleaned.items():
    print(f"   - {src}: {len(rows)} tasks")
print(f"\n   Saved:")
print(f"   → {output_file}")
print(f"   → {full_output}")
print(f"   → {dup_output}")
print("="*60 + "\n")

# Quick diagnostics
print("📊 Top priority:", top_priority())
print("🚧 Blocked tasks:\n", blocked_tasks().to_string() if not blocked_tasks().empty else "  None")
print("👥 Overloaded engineers:\n", overloaded_engineers().to_string())
