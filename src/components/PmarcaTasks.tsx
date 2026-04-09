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
  const [flipped, setFlipped]   = useState(false);
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const allTasks: CardTask[] = [...lists.todo, ...lists.watch, ...lists.later];

  const cardTasks = card.taskIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is CardTask => !!t);

  // ── Mutations ───────────────────────────────────────────────────────────────
  function addTask(title: string, list: ListName) {
    const task: CardTask = { id: nextId(), title, list, createdAt: new Date().toISOString() };
    updateLists({ ...lists, [list]: [...lists[list], task] });
  }

  function moveTask(id: string, to: ListName) {
    const from = (["todo", "watch", "later"] as ListName[]).find(l => lists[l].some(t => t.id === id))!;
    const task = lists[from].find(t => t.id === id)!;
    updateLists({
      ...lists,
      [from]: lists[from].filter(t => t.id !== id),
      [to]: [...lists[to], { ...task, list: to }],
    });
  }

  function addToCard(id: string) {
    if (card.taskIds.length >= 5 || card.taskIds.includes(id)) return;
    updateCard({ ...card, taskIds: [...card.taskIds, id] });
  }

  function checkTask(task: CardTask) {
    const nextCard: DailyCard = {
      ...card,
      taskIds: card.taskIds.filter(id => id !== task.id),
      antiTodo: [...card.antiTodo, task.title],
    };
    const nextLists: Lists = {
      todo:  lists.todo.filter(t => t.id !== task.id),
      watch: lists.watch.filter(t => t.id !== task.id),
      later: lists.later.filter(t => t.id !== task.id),
    };
    setCard(nextCard);
    setLists(nextLists);
    persist(nextLists, nextCard, archive);
  }

  function handleArchive(tomorrowIds: string[]) {
    const archived = { ...card, archivedAt: new Date().toISOString() };
    const nextArchive = [archived, ...archive];
    const nextCard: DailyCard = { date: today(), taskIds: tomorrowIds, antiTodo: [] };
    setCard(nextCard);
    setArchive(nextArchive);
    setFlipped(false);
    persist(lists, nextCard, nextArchive);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
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

      {/* Views */}
      <div style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto" }}>
        {view === "card"    && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>TodayCard — coming in Task 2</div>}
        {view === "lists"   && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ListsPanel — coming in Task 3</div>}
        {view === "archive" && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ArchivePanel — coming in Task 5</div>}
      </div>

      {showEvening && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12, padding: 24 }}>EveningModal — coming in Task 4</div>}
    </div>
  );
}
