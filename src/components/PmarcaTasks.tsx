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

// ─── ArchivePanel ─────────────────────────────────────────────────────────────
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

// ─── EveningModal ─────────────────────────────────────────────────────────────
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
              Review today, then pick tomorrow&#39;s card.
            </p>

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
              Archive card → pick tomorrow&#39;s tasks
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: "#ede8de", margin: "0 0 6px" }}>
              Tomorrow&#39;s card
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
                Set tomorrow&#39;s card ({selected.length})
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

// ─── ListsPanel ───────────────────────────────────────────────────────────────
function ListsPanel({ lists, card, onAdd, onMove, onEdit, onDelete, onAddToCard }: {
  lists: Lists;
  card: DailyCard;
  onAdd: (title: string, list: ListName) => void;
  onMove: (id: string, to: ListName) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onAddToCard: (id: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<ListName, string>>({ todo: "", watch: "", later: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  function submit(list: ListName) {
    const title = drafts[list].trim();
    if (!title) return;
    onAdd(title, list);
    setDrafts(d => ({ ...d, [list]: "" }));
  }

  function startEdit(task: CardTask) {
    setEditingId(task.id);
    setEditText(task.title);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function commitEdit() {
    if (editingId && editText.trim()) {
      onEdit(editingId, editText.trim());
    }
    setEditingId(null);
    setEditText("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  const canAddToCard = (id: string) => card.taskIds.length < 5 && !card.taskIds.includes(id);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
      {(["todo", "watch", "later"] as ListName[]).map(listName => (
        <div key={listName}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#5a5440", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
            {listName}
          </div>

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

          {lists[listName].map(task => (
            <div key={task.id} style={{
              background: "#161510", border: `1px solid ${editingId === task.id ? "#c9a84c" : "#1e1d16"}`, borderRadius: 6,
              padding: "8px 10px", marginBottom: 6,
              transition: "border-color 0.2s ease",
            }}>
              {editingId === task.id ? (
                <input
                  ref={editRef}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onBlur={commitEdit}
                  style={{
                    width: "100%", padding: "2px 4px", marginBottom: 6,
                    background: "rgba(201,168,76,.08)", border: "1px solid #c9a84c",
                    borderRadius: 3, color: "#ede8de", fontSize: 13,
                    fontFamily: "'Georgia', serif", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div
                  onClick={() => startEdit(task)}
                  title="Click to edit"
                  style={{
                    fontSize: 13, color: "#ede8de", marginBottom: 6,
                    cursor: "text", borderRadius: 3, padding: "2px 4px",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {task.title}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                <button onClick={() => onDelete(task.id)} style={{
                  fontSize: 9, fontFamily: "monospace", color: "#c97070",
                  background: "none", border: "1px solid rgba(201,112,112,.3)", borderRadius: 3,
                  padding: "2px 6px", cursor: "pointer", marginLeft: "auto",
                }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── TodayCard ────────────────────────────────────────────────────────────────
function TodayCard({ card, cardTasks, onCheck, onFlip, onAddAntiTodo, flipped }: {
  card: DailyCard;
  cardTasks: CardTask[];
  onCheck: (t: CardTask) => void;
  onFlip: () => void;
  onAddAntiTodo: (text: string) => void;
  flipped: boolean;
}) {
  const [antiDraft, setAntiDraft] = useState("");
  const ruled = {
    backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, #d4cdb8 27px, #d4cdb8 28px)`,
    backgroundPositionY: "36px",
  };

  function submitAntiTodo() {
    const text = antiDraft.trim();
    if (!text) return;
    onAddAntiTodo(text);
    setAntiDraft("");
  }

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
          {card.antiTodo.length === 0 && (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#a09070", fontStyle: "italic", marginBottom: 14 }}>
              Nothing logged yet. Add accomplishments below.
            </p>
          )}
          {card.antiTodo.map((entry, i) => (
            <div key={i} style={{ fontFamily: "'Georgia', serif", fontSize: 14, color: "#2a2010", marginBottom: 10, display: "flex", gap: 10 }}>
              <span style={{ color: "#6aaa6a" }}>✓</span> {entry}
            </div>
          ))}

          {/* Manual Anti-Todo input */}
          <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
            <input
              value={antiDraft}
              onChange={e => setAntiDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitAntiTodo()}
              placeholder="+ log something you did…"
              style={{
                flex: 1, padding: "6px 8px",
                background: "rgba(106,170,106,.06)",
                border: "1px solid rgba(106,170,106,.25)",
                borderRadius: 4, color: "#2a2010", fontSize: 12,
                fontFamily: "monospace", outline: "none",
              }}
            />
            <button onClick={submitAntiTodo} style={{
              padding: "6px 10px", background: "rgba(106,170,106,.12)",
              border: "1px solid rgba(106,170,106,.25)",
              borderRadius: 4, color: "#4a8a4a", fontFamily: "monospace",
              fontSize: 11, cursor: "pointer", fontWeight: 600,
            }}>✓</button>
          </div>
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

  const editTask = useCallback((id: string, newTitle: string) => {
    const currentLists = stateRef.current.lists;
    const next: Lists = {
      todo: currentLists.todo.map(t => t.id === id ? { ...t, title: newTitle } : t),
      watch: currentLists.watch.map(t => t.id === id ? { ...t, title: newTitle } : t),
      later: currentLists.later.map(t => t.id === id ? { ...t, title: newTitle } : t),
    };
    stateRef.current.lists = next;
    setLists(next);
    persist();
  }, [persist]);

  const deleteTask = useCallback((id: string) => {
    const currentLists = stateRef.current.lists;
    const currentCard = stateRef.current.card;
    const nextLists: Lists = {
      todo: currentLists.todo.filter(t => t.id !== id),
      watch: currentLists.watch.filter(t => t.id !== id),
      later: currentLists.later.filter(t => t.id !== id),
    };
    const nextCard: DailyCard = {
      ...currentCard,
      taskIds: currentCard.taskIds.filter(tid => tid !== id),
    };
    stateRef.current.lists = nextLists;
    stateRef.current.card = nextCard;
    setLists(nextLists);
    setCard(nextCard);
    persist();
  }, [persist]);

  function addAntiTodo(text: string) {
    const nextCard: DailyCard = {
      ...stateRef.current.card,
      antiTodo: [...stateRef.current.card.antiTodo, text],
    };
    updateCard(nextCard);
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
            onAddAntiTodo={addAntiTodo}
            flipped={flipped}
          />
        )}
        {view === "lists" && (
          <ListsPanel
            lists={lists}
            card={card}
            onAdd={addTask}
            onMove={moveTask}
            onEdit={editTask}
            onDelete={deleteTask}
            onAddToCard={addToCard}
          />
        )}
        {view === "archive" && (
          <ArchivePanel archive={archive} allTasks={allTasks} />
        )}
      </div>

      {showEvening && (
        <EveningModal
          card={card}
          allTasks={allTasks}
          onArchive={handleArchive}
          onClose={() => setShowEvening(false)}
        />
      )}
    </div>
  );
}
