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

// Fix 1: Use local date instead of UTC
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

// ─── TodayCard ────────────────────────────────────────────────────────────────
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
        <div>
          {cardTasks.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#a09070", fontStyle: "italic" }}>
              No tasks on today&#39;s card. Use the evening ritual to pick 3–5.
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

  // Fix 2: stateRef to avoid stale closures in persist and updaters
  const stateRef = useRef({ lists: emptyLists(), card: emptyCard(), archive: [] as DailyCard[] });

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [lr, cr, ar] = await Promise.all([
        store.get(LISTS_KEY),
        store.get(CARD_KEY),
        store.get(ARCHIVE_KEY),
      ]);
      let parsedLists = emptyLists();
      let parsedCard = emptyCard();
      let parsedArchive: DailyCard[] = [];
      try { if (lr?.value) parsedLists = JSON.parse(lr.value); } catch {}
      try {
        if (cr?.value) {
          const saved: DailyCard = JSON.parse(cr.value);
          parsedCard = saved.date === today() ? saved : emptyCard();
        }
      } catch {}
      try { if (ar?.value) parsedArchive = JSON.parse(ar.value); } catch {}
      // Sync ref before setting state so persist always sees current values
      stateRef.current.lists = parsedLists;
      stateRef.current.card = parsedCard;
      stateRef.current.archive = parsedArchive;
      setLists(parsedLists);
      setCard(parsedCard);
      setArchive(parsedArchive);
      setLoading(false);
    })();
  }, []);

  // ── Persist (reads from ref — never stale) ───────────────────────────────────
  const persist = useCallback(() => {
    const { lists: l, card: c, archive: a } = stateRef.current;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      store.set(LISTS_KEY, JSON.stringify(l));
      store.set(CARD_KEY, JSON.stringify(c));
      store.set(ARCHIVE_KEY, JSON.stringify(a));
    }, 800);
  }, []);

  const updateLists = useCallback((next: Lists) => {
    stateRef.current.lists = next;
    setLists(next);
    persist();
  }, [persist]);

  const updateCard = useCallback((next: DailyCard) => {
    stateRef.current.card = next;
    setCard(next);
    persist();
  }, [persist]);

  const updateArchive = useCallback((next: DailyCard[]) => {
    stateRef.current.archive = next;
    setArchive(next);
    persist();
  }, [persist]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const allTasks: CardTask[] = [...lists.todo, ...lists.watch, ...lists.later];

  const cardTasks = card.taskIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is CardTask => !!t);

  // ── Mutations ───────────────────────────────────────────────────────────────

  // Fix 3: wrap addTask and moveTask in useCallback; both read from stateRef
  const addTask = useCallback((title: string, list: ListName) => {
    const task: CardTask = { id: nextId(), title, list, createdAt: new Date().toISOString() };
    const next = { ...stateRef.current.lists, [list]: [...stateRef.current.lists[list], task] };
    stateRef.current.lists = next;
    setLists(next);
    persist();
  }, [persist]);

  const moveTask = useCallback((id: string, to: ListName) => {
    const currentLists = stateRef.current.lists;
    const from = (["todo", "watch", "later"] as ListName[]).find(l => currentLists[l].some(t => t.id === id));
    if (!from) return;
    const task = currentLists[from].find(t => t.id === id);
    if (!task) return;
    const next: Lists = {
      ...currentLists,
      [from]: currentLists[from].filter(t => t.id !== id),
      [to]: [...currentLists[to], { ...task, list: to }],
    };
    stateRef.current.lists = next;
    setLists(next);
    persist();
  }, [persist]);

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
    stateRef.current.card = nextCard;
    stateRef.current.lists = nextLists;
    setCard(nextCard);
    setLists(nextLists);
    persist();
  }

  function handleArchive(tomorrowIds: string[]) {
    const archived = { ...card, archivedAt: new Date().toISOString() };
    const nextArchive = [archived, ...archive];
    const nextCard: DailyCard = { date: today(), taskIds: tomorrowIds, antiTodo: [] };
    stateRef.current.card = nextCard;
    stateRef.current.archive = nextArchive;
    setCard(nextCard);
    setArchive(nextArchive);
    setFlipped(false);
    persist();
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
        {view === "card" && (
          <TodayCard
            card={card}
            cardTasks={cardTasks}
            onCheck={checkTask}
            onFlip={() => setFlipped(f => !f)}
            flipped={flipped}
          />
        )}
        {view === "lists"   && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ListsPanel — coming in Task 3</div>}
        {view === "archive" && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12 }}>ArchivePanel — coming in Task 5</div>}
      </div>

      {showEvening && <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 12, padding: 24 }}>EveningModal — coming in Task 4</div>}
    </div>
  );
}
