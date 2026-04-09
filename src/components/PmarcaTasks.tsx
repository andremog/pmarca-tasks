"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { storage as supabaseStorage } from "@/lib/storage";

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "pmarca-tasks-v1";
const ARCHIVE_KEY = "pmarca-tasks-archive-v1";
const STREAK_KEY  = "pmarca-tasks-streak-v1";
const MAX_CARD    = 3;

// ─── Storage adapter (Supabase-backed) ───────────────────────────────────────
const store = {
  async get(key: string) {
    try {
      return await Promise.race([
        supabaseStorage.get(key),
        new Promise<null>((_, r) => setTimeout(() => r("timeout"), 5000)),
      ]);
    } catch { return null; }
  },
  async set(key: string, value: string) {
    try { await supabaseStorage.set(key, value); } catch {}
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = "high" | "medium" | "low";
type Status   = "todo" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags: string[];
}

interface AppState {
  tasks: Task[];
  lastUpdated: string;
}

const DEFAULT_STATE: AppState = { tasks: [], lastUpdated: new Date().toISOString() };

function nextId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PmarcaTasks() {
  const [state, setState]       = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"board" | "list">("board");
  const [filter, setFilter]     = useState<Status | "all">("all");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newTask, setNewTask]   = useState(false);
  const saveTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const raw = await store.get(STORAGE_KEY);
      if (raw?.value) {
        try { setState(JSON.parse(raw.value)); } catch {}
      }
      setLoading(false);
    })();
  }, []);

  // ── Persist (debounced) ───────────────────────────────────────────────────
  const persist = useCallback((next: AppState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      store.set(STORAGE_KEY, JSON.stringify(next));
    }, 800);
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState(prev => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  // ── Task helpers ──────────────────────────────────────────────────────────
  const addTask = (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    update(s => ({
      ...s,
      tasks: [...s.tasks, { ...t, id: nextId(), createdAt: now, updatedAt: now }],
      lastUpdated: now,
    }));
    setNewTask(false);
  };

  const saveTask = (t: Task) => {
    update(s => ({
      ...s,
      tasks: s.tasks.map(x => x.id === t.id ? { ...t, updatedAt: new Date().toISOString() } : x),
      lastUpdated: new Date().toISOString(),
    }));
    setEditTask(null);
  };

  const deleteTask = (id: string) => {
    update(s => ({
      ...s,
      tasks: s.tasks.filter(x => x.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
    setEditTask(null);
  };

  const cycleStatus = (id: string) => {
    const cycle: Record<Status, Status> = { todo: "in_progress", in_progress: "done", done: "todo" };
    update(s => ({
      ...s,
      tasks: s.tasks.map(x => x.id === id ? { ...x, status: cycle[x.status], updatedAt: new Date().toISOString() } : x),
      lastUpdated: new Date().toISOString(),
    }));
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const visible = useMemo(() =>
    filter === "all" ? state.tasks : state.tasks.filter(t => t.status === filter),
    [state.tasks, filter]
  );

  const byStatus = (s: Status) => visible.filter(t => t.status === s);

  // ── Styles ────────────────────────────────────────────────────────────────
  const C = {
    bg:      "#0f0e09",
    surface: "#161510",
    border:  "#1e1d16",
    text:    "#ede8de",
    muted:   "#5a5440",
    gold:    "#c9a84c",
    green:   "#6aaa6a",
    red:     "#c97070",
    blue:    "#7090c9",
  };

  const priorityColor: Record<Priority, string> = {
    high: C.red, medium: C.gold, low: C.muted,
  };

  const statusLabel: Record<Status, string> = {
    todo: "Todo", in_progress: "In Progress", done: "Done",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 12, color: C.muted }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Georgia', serif", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>
            pmarca <em style={{ color: C.gold }}>tasks</em>
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "todo", "in_progress", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "4px 12px", borderRadius: 4, border: `1px solid ${filter === f ? C.gold : C.border}`,
                background: filter === f ? C.gold : "transparent", color: filter === f ? "#1a1410" : C.muted,
                fontSize: 11, fontFamily: "monospace", cursor: "pointer", letterSpacing: ".04em",
              }}>
                {f === "all" ? "All" : statusLabel[f]}
              </button>
            ))}
            <button onClick={() => setNewTask(true)} style={{
              padding: "4px 14px", borderRadius: 4, border: `1px solid ${C.gold}`,
              background: "transparent", color: C.gold, fontSize: 11, fontFamily: "monospace",
              cursor: "pointer", letterSpacing: ".04em",
            }}>
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {(["todo", "in_progress", "done"] as Status[]).map(col => (
          <div key={col}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
              {statusLabel[col]} <span style={{ color: C.border }}>({byStatus(col).length})</span>
            </div>
            {byStatus(col).map(task => (
              <div key={task.id} onClick={() => setEditTask(task)} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "12px 14px", marginBottom: 8, cursor: "pointer",
                borderLeft: `3px solid ${priorityColor[task.priority]}`,
              }}>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{task.title}</div>
                {task.description && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 1.4 }}>{task.description}</div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {task.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 9, fontFamily: "monospace", color: C.muted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, padding: "1px 6px" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* New Task Modal */}
      {newTask && (
        <TaskModal
          onSave={addTask as any}
          onClose={() => setNewTask(false)}
          C={C}
        />
      )}

      {/* Edit Task Modal */}
      {editTask && (
        <TaskModal
          task={editTask}
          onSave={saveTask as any}
          onDelete={() => deleteTask(editTask.id)}
          onClose={() => setEditTask(null)}
          C={C}
        />
      )}
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ task, onSave, onDelete, onClose, C }: {
  task?: Task;
  onSave: (t: any) => void;
  onDelete?: () => void;
  onClose: () => void;
  C: Record<string, string>;
}) {
  const [title, setTitle]       = useState(task?.title ?? "");
  const [desc, setDesc]         = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [status, setStatus]     = useState<Status>(task?.status ?? "todo");
  const [tags, setTags]         = useState(task?.tags.join(", ") ?? "");
  const [due, setDue]           = useState(task?.dueDate ?? "");

  const handle = () => {
    if (!title.trim()) return;
    onSave({
      ...(task ?? {}),
      title: title.trim(),
      description: desc.trim(),
      priority,
      status,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      dueDate: due || undefined,
    });
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", background: "#1a1914",
    border: `1px solid ${C.border}`, borderRadius: 5, color: C.text,
    fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#161510", border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 28, width: "90%", maxWidth: 460,
      }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: C.text, margin: "0 0 20px" }}>
          {task ? "Edit Task" : "New Task"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          <textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />

          <div style={{ display: "flex", gap: 8 }}>
            {(["high", "medium", "low"] as Priority[]).map(p => (
              <button key={p} onClick={() => setPriority(p)} style={{
                flex: 1, padding: "6px 0", borderRadius: 4,
                border: `1px solid ${priority === p ? C.gold : C.border}`,
                background: priority === p ? C.gold : "transparent",
                color: priority === p ? "#1a1410" : C.muted,
                fontSize: 11, fontFamily: "monospace", cursor: "pointer",
              }}>{p}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {(["todo", "in_progress", "done"] as Status[]).map(s => (
              <button key={s} onClick={() => setStatus(s)} style={{
                flex: 1, padding: "6px 0", borderRadius: 4,
                border: `1px solid ${status === s ? C.blue : C.border}`,
                background: status === s ? C.blue : "transparent",
                color: status === s ? "#fff" : C.muted,
                fontSize: 10, fontFamily: "monospace", cursor: "pointer",
              }}>{s.replace("_", " ")}</button>
            ))}
          </div>

          <input placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} style={inputStyle} />
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={handle} style={{
            flex: 1, padding: 10, background: C.gold, border: "none", borderRadius: 6,
            color: "#1a1410", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "monospace",
          }}>Save</button>
          {onDelete && (
            <button onClick={onDelete} style={{
              padding: "10px 16px", background: "transparent", border: `1px solid ${C.red}`,
              borderRadius: 6, color: C.red, fontSize: 13, cursor: "pointer", fontFamily: "monospace",
            }}>Delete</button>
          )}
          <button onClick={onClose} style={{
            padding: "10px 16px", background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "monospace",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
