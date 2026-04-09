# pmarca-tasks: Card-First Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Kanban board entirely with a faithful implementation of the Marc Andreessen personal productivity system — daily 3×5 index card, three lists (Todo/Watch/Later), and anti-todo.

**Architecture:** Single client component file (`PmarcaTasks.tsx`) split into four sub-components rendered conditionally: `TodayCard`, `ListsPanel`, `EveningModal`, `ArchivePanel`. State and persistence live in the root component. No test infrastructure exists — use `npm run build` as the TypeScript verification gate between tasks.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Supabase-backed storage (existing `store` adapter), inline styles with the existing dark parchment palette.

**Design doc:** `docs/plans/2026-04-08-pmarca-system-redesign.md`

---

### Task 1: Replace data model and clear old code

**Files:**
- Modify: `src/components/PmarcaTasks.tsx` (full rewrite)

**Step 1: Replace the entire file with the new skeleton**

Delete everything in `PmarcaTasks.tsx` and replace with:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { storage as supabaseStorage } from "@/lib/storage";

// ─── Storage ──────────────────────────────────────────────────────────────────
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

const LISTS_KEY   = "pmarca-lists-v1";
const CARD_KEY    = "pmarca-card-v1";
const ARCHIVE_KEY = "pmarca-archive-v1";

// ─── Types ────────────────────────────────────────────────────────────────────
type ListName = "todo" | "watch" | "later";

interface CardTask {
  id: string;
  title: string;
  list: ListName;
  createdAt: string;
}

interface DailyCard {
  date: string;        // YYYY-MM-DD
  taskIds: string[];   // 3–5 ids
  antiTodo: string[];  // accomplishments logged during the day
  archivedAt?: string;
}

interface Lists {
  todo: CardTask[];
  watch: CardTask[];
  later: CardTask[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function nextId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyCard(): DailyCard {
  return { date: today(), taskIds: [], antiTodo: [] };
}

function emptyLists(): Lists {
  return { todo: [], watch: [], later: [] };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#0f0e09",
  surface: "#161510",
  border:  "#1e1d16",
  text:    "#ede8de",
  muted:   "#5a5440",
  gold:    "#c9a84c",
  green:   "#6aaa6a",
  red:     "#c97070",
  card:    "#f5f0e8",
  cardLine:"#d4cdb8",
  cardText:"#1a1610",
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function PmarcaTasks() {
  const [lists, setLists]       = useState<Lists>(emptyLists());
  const [card, setCard]         = useState<DailyCard>(emptyCard());
  const [archive, setArchive]   = useState<DailyCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<"card" | "lists" | "archive">("card");
  const [showEvening, setShowEvening] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [lr, cr, ar] = await Promise.all([
        store.get(LISTS_KEY),
        store.get(CARD_KEY),
        store.get(ARCHIVE_KEY),
      ]);
      try { if (lr?.value) setLists(JSON.parse(lr.value)); } catch {}
      try {
        if (cr?.value) {
          const saved: DailyCard = JSON.parse(cr.value);
          // New day — start fresh card but keep lists
          setCard(saved.date === today() ? saved : emptyCard());
        }
      } catch {}
      try { if (ar?.value) setArchive(JSON.parse(ar.value)); } catch {}
      setLoading(false);
    })();
  }, []);

  // ── Persist ─────────────────────────────────────────────────────────────────
  const persist = useCallback((l: Lists, c: DailyCard, a: DailyCard[]) => {
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      store.set(LISTS_KEY, JSON.stringify(l));
      store.set(CARD_KEY, JSON.stringify(c));
      store.set(ARCHIVE_KEY, JSON.stringify(a));
    }, 800);
  }, []);

  const updateLists = useCallback((next: Lists) => {
    setLists(next);
    persist(next, card, archive);
  }, [card, archive, persist]);

  const updateCard = useCallback((next: DailyCard) => {
    setCard(next);
    persist(lists, next, archive);
  }, [lists, archive, persist]);

  const updateArchive = useCallback((next: DailyCard[]) => {
    setArchive(next);
    persist(lists, card, next);
  }, [lists, card, persist]);

  // ── Helpers passed to children ───────────────────────────────────────────────
  const allTasks: CardTask[] = [...lists.todo, ...lists.watch, ...lists.later];

  const cardTasks = card.taskIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is CardTask => !!t);

  function addToCard(id: string) {
    if (card.taskIds.length >= 5 || card.taskIds.includes(id)) return;
    updateCard({ ...card, taskIds: [...card.taskIds, id] });
  }

  function checkTask(task: CardTask) {
    const next: DailyCard = {
      ...card,
      taskIds: card.taskIds.filter(id => id !== task.id),
      antiTodo: [...card.antiTodo, task.title],
    };
    // Also remove from list
    const nextLists = {
      todo:  lists.todo.filter(t => t.id !== task.id),
      watch: lists.watch.filter(t => t.id !== task.id),
      later: lists.later.filter(t => t.id !== task.id),
    };
    setCard(next);
    setLists(nextLists);
    persist(nextLists, next, archive);
  }

  function archiveCard() {
    const archived = { ...card, archivedAt: new Date().toISOString() };
    const nextArchive = [archived, ...archive];
    const nextCard = emptyCard();
    setCard(nextCard);
    setArchive(nextArchive);
    persist(lists, nextCard, nextArchive);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 12, color: C.muted }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          pmarca <em style={{ color: C.gold }}>tasks</em>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {(["card", "lists", "archive"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "4px 14px", borderRadius: 4,
              border: `1px solid ${view === v ? C.gold : C.border}`,
              background: view === v ? C.gold : "transparent",
              color: view === v ? "#1a1410" : C.muted,
              fontSize: 11, fontFamily: "monospace", cursor: "pointer", letterSpacing: ".04em",
            }}>{v}</button>
          ))}
          <button onClick={() => setShowEvening(true)} style={{
            padding: "4px 14px", borderRadius: 4, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted, fontSize: 11,
            fontFamily: "monospace", cursor: "pointer", letterSpacing: ".04em",
          }}>evening →</button>
        </div>
      </nav>

      {/* Views — components added in later tasks */}
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        {view === "card"    && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>TodayCard — Task 2</div>}
        {view === "lists"   && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ListsPanel — Task 3</div>}
        {view === "archive" && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ArchivePanel — Task 5</div>}
      </div>

      {showEvening && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>EveningModal — Task 4</div>}
    </div>
  );
}
```

**Step 2: Verify build passes**

```bash
npm run build
```
Expected: compiled successfully (TypeScript errors = fix before continuing)

**Step 3: Commit**

```bash
git add src/components/PmarcaTasks.tsx
git commit -m "refactor: replace kanban with pmarca skeleton (types + state + nav)"
```

---

### Task 2: Build TodayCard component

**Files:**
- Modify: `src/components/PmarcaTasks.tsx` — replace the `TodayCard — Task 2` placeholder

**Step 1: Add the TodayCard component** (paste above the `PmarcaTasks` export default, or at bottom of file)

```tsx
function TodayCard({ card, cardTasks, onCheck, onFlip, flipped }: {
  card: DailyCard;
  cardTasks: CardTask[];
  onCheck: (t: CardTask) => void;
  onFlip: () => void;
  flipped: boolean;
}) {
  const ruled = {
    backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, #d4cdb8 27px, #d4cdb8 28px)`,
    backgroundPositionY: "36px",
  };

  return (
    <div style={{
      background: "#f5f0e8", borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,.5)",
      padding: "32px 36px 28px", minHeight: 280, position: "relative", ...ruled,
    }}>
      {/* Date + flip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#8a7f6a", letterSpacing: ".06em" }}>
          {card.date}
        </span>
        <button onClick={onFlip} style={{
          fontFamily: "monospace", fontSize: 10, color: "#8a7f6a",
          background: "none", border: "none", cursor: "pointer", letterSpacing: ".06em",
        }}>
          {flipped ? "← front" : "back →"}
        </button>
      </div>

      {!flipped ? (
        /* Front: tasks */
        <div>
          {cardTasks.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#a09070", fontStyle: "italic" }}>
              No tasks on today's card. Use the evening ritual to pick 3–5.
            </p>
          ) : (
            cardTasks.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <span style={{ fontFamily: "monospace", fontSize: 13, color: "#8a7f6a", minWidth: 16 }}>{i + 1}.</span>
                <input
                  type="checkbox"
                  onChange={() => onCheck(t)}
                  style={{ marginTop: 3, accentColor: "#6aaa6a", cursor: "pointer" }}
                />
                <span style={{ fontFamily: "'Georgia', serif", fontSize: 15, color: "#1a1610", lineHeight: 1.5 }}>
                  {t.title}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Back: anti-todo */
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#8a7f6a", letterSpacing: ".08em", marginBottom: 14, textTransform: "uppercase" }}>
            Done today
          </div>
          {card.antiTodo.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#a09070", fontStyle: "italic" }}>
              Nothing logged yet. Check tasks off on the front.
            </p>
          ) : (
            card.antiTodo.map((entry, i) => (
              <div key={i} style={{ fontFamily: "'Georgia', serif", fontSize: 14, color: "#2a2010", marginBottom: 10, display: "flex", gap: 10 }}>
                <span style={{ color: "#6aaa6a" }}>✓</span> {entry}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add `flipped` state to root and wire TodayCard**

In `PmarcaTasks`, add:
```tsx
const [flipped, setFlipped] = useState(false);
```

Replace the card placeholder line:
```tsx
{view === "card" && <div ...>TodayCard — Task 2</div>}
```
With:
```tsx
{view === "card" && (
  <TodayCard
    card={card}
    cardTasks={cardTasks}
    onCheck={checkTask}
    onFlip={() => setFlipped(f => !f)}
    flipped={flipped}
  />
)}
```

**Step 3: Verify build passes**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/PmarcaTasks.tsx
git commit -m "feat: add TodayCard with front/back flip and anti-todo"
```

---

### Task 3: Build ListsPanel component

**Files:**
- Modify: `src/components/PmarcaTasks.tsx`

**Step 1: Add the ListsPanel component**

```tsx
function ListsPanel({ lists, card, onAdd, onMove, onAddToCard }: {
  lists: Lists;
  card: DailyCard;
  onAdd: (title: string, list: ListName) => void;
  onMove: (id: string, to: ListName) => void;
  onAddToCard: (id: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<ListName, string>>({ todo: "", watch: "", later: "" });

  function submit(list: ListName) {
    const title = drafts[list].trim();
    if (!title) return;
    onAdd(title, list);
    setDrafts(d => ({ ...d, [list]: "" }));
  }

  const canAddToCard = (id: string) => card.taskIds.length < 5 && !card.taskIds.includes(id);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
      {(["todo", "watch", "later"] as ListName[]).map(listName => (
        <div key={listName}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#5a5440", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
            {listName}
          </div>

          {/* Inline add */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              value={drafts[listName]}
              onChange={e => setDrafts(d => ({ ...d, [listName]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && submit(listName)}
              placeholder="+ add task"
              style={{
                flex: 1, padding: "6px 8px", background: "#161510",
                border: "1px solid #1e1d16", borderRadius: 4,
                color: "#ede8de", fontSize: 12, fontFamily: "monospace", outline: "none",
              }}
            />
            <button onClick={() => submit(listName)} style={{
              padding: "6px 10px", background: "transparent", border: "1px solid #1e1d16",
              borderRadius: 4, color: "#5a5440", fontFamily: "monospace",
              fontSize: 11, cursor: "pointer",
            }}>+</button>
          </div>

          {/* Tasks */}
          {lists[listName].map(task => (
            <div key={task.id} style={{
              background: "#161510", border: "1px solid #1e1d16", borderRadius: 6,
              padding: "8px 10px", marginBottom: 6,
            }}>
              <div style={{ fontSize: 13, color: "#ede8de", marginBottom: 6 }}>{task.title}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {canAddToCard(task.id) && (
                  <button onClick={() => onAddToCard(task.id)} style={{
                    fontSize: 9, fontFamily: "monospace", color: "#c9a84c",
                    background: "none", border: "1px solid #c9a84c", borderRadius: 3,
                    padding: "2px 6px", cursor: "pointer",
                  }}>→ card</button>
                )}
                {(["todo", "watch", "later"] as ListName[]).filter(l => l !== listName).map(l => (
                  <button key={l} onClick={() => onMove(task.id, l)} style={{
                    fontSize: 9, fontFamily: "monospace", color: "#5a5440",
                    background: "none", border: "1px solid #1e1d16", borderRadius: 3,
                    padding: "2px 6px", cursor: "pointer",
                  }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Add list mutation helpers to root PmarcaTasks**

```tsx
function addTask(title: string, list: ListName) {
  const task: CardTask = { id: nextId(), title, list, createdAt: new Date().toISOString() };
  const nextLists = { ...lists, [list]: [...lists[list], task] };
  updateLists(nextLists);
}

function moveTask(id: string, to: ListName) {
  const from = (["todo", "watch", "later"] as ListName[]).find(l => lists[l].some(t => t.id === id))!;
  const task = lists[from].find(t => t.id === id)!;
  const nextLists = {
    ...lists,
    [from]: lists[from].filter(t => t.id !== id),
    [to]: [...lists[to], { ...task, list: to }],
  };
  updateLists(nextLists);
}
```

**Step 3: Replace lists placeholder with component**

```tsx
{view === "lists" && (
  <ListsPanel
    lists={lists}
    card={card}
    onAdd={addTask}
    onMove={moveTask}
    onAddToCard={addToCard}
  />
)}
```

**Step 4: Verify build passes**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/components/PmarcaTasks.tsx
git commit -m "feat: add ListsPanel with three lists, inline add, move, and card promotion"
```

---

### Task 4: Build EveningModal component

**Files:**
- Modify: `src/components/PmarcaTasks.tsx`

**Step 1: Add the EveningModal component**

```tsx
function EveningModal({ card, allTasks, onArchive, onClose }: {
  card: DailyCard;
  allTasks: CardTask[];
  onArchive: (tomorrowIds: string[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"review" | "pick">("review");
  const [selected, setSelected] = useState<string[]>([]);

  function togglePick(id: string) {
    setSelected(s =>
      s.includes(id) ? s.filter(x => x !== id) : s.length < 5 ? [...s, id] : s
    );
  }

  function finish() {
    onArchive(selected);
    onClose();
  }

  const available = allTasks.filter(t => !card.taskIds.includes(t.id));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#161510", border: "1px solid #1e1d16", borderRadius: 12,
        padding: 32, width: "90%", maxWidth: 500,
      }}>
        {step === "review" ? (
          <>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: "#ede8de", margin: "0 0 6px" }}>
              Evening ritual
            </h2>
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#5a5440", margin: "0 0 20px" }}>
              Review today, then pick tomorrow's card.
            </p>

            {/* Anti-todo recap */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#5a5440", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
                Done today
              </div>
              {card.antiTodo.length === 0 ? (
                <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5a5440", fontStyle: "italic" }}>Nothing logged.</p>
              ) : card.antiTodo.map((e, i) => (
                <div key={i} style={{ fontSize: 13, color: "#6aaa6a", fontFamily: "'Georgia', serif", marginBottom: 6 }}>✓ {e}</div>
              ))}
            </div>

            <button onClick={() => setStep("pick")} style={{
              width: "100%", padding: 10, background: "#c9a84c", border: "none",
              borderRadius: 6, color: "#1a1410", fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: "monospace",
            }}>
              Archive card → pick tomorrow's tasks
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: "#ede8de", margin: "0 0 6px" }}>
              Tomorrow's card
            </h2>
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#5a5440", margin: "0 0 20px" }}>
              Pick 3–5 tasks ({selected.length}/5 selected)
            </p>

            <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 20 }}>
              {available.length === 0 ? (
                <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5a5440", fontStyle: "italic" }}>No tasks in lists. Add some first.</p>
              ) : available.map(t => {
                const on = selected.includes(t.id);
                return (
                  <div key={t.id} onClick={() => togglePick(t.id)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 5, marginBottom: 4,
                    border: `1px solid ${on ? "#c9a84c" : "#1e1d16"}`,
                    background: on ? "rgba(201,168,76,.08)" : "transparent",
                    cursor: selected.length < 5 || on ? "pointer" : "default",
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: on ? "#c9a84c" : "#5a5440", minWidth: 14 }}>
                      {on ? "●" : "○"}
                    </span>
                    <span style={{ fontSize: 13, color: "#ede8de" }}>{t.title}</span>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "#5a5440", marginLeft: "auto" }}>{t.list}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={finish} disabled={selected.length < 3} style={{
                flex: 1, padding: 10,
                background: selected.length >= 3 ? "#c9a84c" : "#1e1d16",
                border: "none", borderRadius: 6,
                color: selected.length >= 3 ? "#1a1410" : "#5a5440",
                fontWeight: 600, fontSize: 13, cursor: selected.length >= 3 ? "pointer" : "default",
                fontFamily: "monospace",
              }}>
                Set tomorrow's card ({selected.length})
              </button>
              <button onClick={() => setStep("review")} style={{
                padding: "10px 16px", background: "transparent",
                border: "1px solid #1e1d16", borderRadius: 6,
                color: "#5a5440", fontSize: 13, cursor: "pointer", fontFamily: "monospace",
              }}>← back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Wire EveningModal in root**

Add helper:
```tsx
function handleArchive(tomorrowIds: string[]) {
  const archived = { ...card, archivedAt: new Date().toISOString() };
  const nextArchive = [archived, ...archive];
  const nextCard: DailyCard = { date: today(), taskIds: tomorrowIds, antiTodo: [] };
  setCard(nextCard);
  setArchive(nextArchive);
  setFlipped(false);
  persist(lists, nextCard, nextArchive);
}
```

Replace EveningModal placeholder:
```tsx
{showEvening && (
  <EveningModal
    card={card}
    allTasks={allTasks}
    onArchive={handleArchive}
    onClose={() => setShowEvening(false)}
  />
)}
```

**Step 3: Verify build passes**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/PmarcaTasks.tsx
git commit -m "feat: add EveningModal — archive card and pick tomorrow's tasks"
```

---

### Task 5: Build ArchivePanel component

**Files:**
- Modify: `src/components/PmarcaTasks.tsx`

**Step 1: Add the ArchivePanel component**

```tsx
function ArchivePanel({ archive, allTasks }: {
  archive: DailyCard[];
  allTasks: CardTask[];
}) {
  if (archive.length === 0) return (
    <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5a5440", fontStyle: "italic" }}>
      No archived cards yet. Complete the evening ritual to archive your first card.
    </p>
  );

  return (
    <div>
      {archive.map((c, i) => (
        <div key={i} style={{
          background: "#161510", border: "1px solid #1e1d16", borderRadius: 8,
          padding: "16px 20px", marginBottom: 12,
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#5a5440", letterSpacing: ".08em", marginBottom: 10 }}>
            {c.date}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#5a5440", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Card</div>
              {c.taskIds.map(id => {
                const t = allTasks.find(x => x.id === id);
                return (
                  <div key={id} style={{ fontSize: 12, color: "#ede8de", fontFamily: "'Georgia', serif", marginBottom: 4 }}>
                    {t ? t.title : <em style={{ color: "#5a5440" }}>deleted</em>}
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#5a5440", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Done</div>
              {c.antiTodo.map((e, j) => (
                <div key={j} style={{ fontSize: 12, color: "#6aaa6a", fontFamily: "'Georgia', serif", marginBottom: 4 }}>✓ {e}</div>
              ))}
              {c.antiTodo.length === 0 && <em style={{ fontSize: 11, color: "#5a5440", fontFamily: "monospace" }}>nothing logged</em>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Replace archive placeholder**

```tsx
{view === "archive" && (
  <ArchivePanel archive={archive} allTasks={allTasks} />
)}
```

**Step 3: Verify build passes**

```bash
npm run build
```

**Step 4: Final commit + push**

```bash
git add src/components/PmarcaTasks.tsx
git commit -m "feat: add ArchivePanel — read-only history of past cards"
git push
```

---

### Task 6: Smoke test the full flow

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Walk through the full pmarca flow**

1. Go to **lists** view → add 5 tasks across Todo / Watch / Later
2. Click **evening →** modal → review (empty anti-todo) → pick 3 tasks → set card
3. Go to **card** view → verify 3 tasks appear numbered
4. Check one task → verify it moves to the back (anti-todo)
5. Flip card → verify anti-todo shows the checked item
6. Open **evening →** again → archive → pick new tasks
7. Go to **archive** view → verify past card shows

**Step 3: Fix any issues found, then push**

```bash
git add -A
git commit -m "fix: smoke test corrections"
git push
```
