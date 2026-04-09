# pmarca-tasks: Full System Redesign

**Date:** 2026-04-08
**Approach:** Card-First (Option 1)
**Reference:** https://pmarchive.com/guide_to_personal_productivity.html

---

## Context

The current app is a generic Kanban board (todo / in-progress / done, with priority, tags, due dates). Marc Andreessen's actual productivity system has nothing to do with Kanban. It is built around a daily 3×5 index card, three lists (Todo / Watch / Later), and an anti-todo. The redesign replaces the Kanban model entirely with a faithful implementation of the pmarca system.

---

## Core System Rules (from the guide)

- **Three lists only:** Todo, Watch, Later. Everything else is discarded.
- **Daily index card:** Each evening, pick 3–5 critical tasks for tomorrow. That card is the only workspace during the day.
- **Anti-todo:** As tasks are completed, log them on the reverse of the card for psychological reward.
- **Structured procrastination:** The lists surface secondary tasks available when avoiding harder ones.
- **No schedule, no priority fields, no tags, no due dates.** Card position IS the priority.

---

## Data Model

### `CardTask`
```ts
interface CardTask {
  id: string;
  title: string;
  list: "todo" | "watch" | "later";
  createdAt: string;
}
```

### `DailyCard`
```ts
interface DailyCard {
  date: string;           // YYYY-MM-DD
  taskIds: string[];      // 3–5 ids from lists
  antiTodo: string[];     // accomplishments logged during the day
  archivedAt?: string;
}
```

### `AppState`
```ts
interface AppState {
  lists: {
    todo: CardTask[];
    watch: CardTask[];
    later: CardTask[];
  };
  cards: DailyCard[];     // archive of past cards
  today: DailyCard;       // active card
}
```

**Removed entirely:** `priority`, `status`, `tags`, `dueDate`, `description`.

---

## Storage Keys

| Key | Contents |
|---|---|
| `pmarca-lists-v1` | The three lists |
| `pmarca-card-v1` | Today's active card |
| `pmarca-archive-v1` | Past cards array |

---

## Views

### 1. Today's Card (primary, full-screen)
- Renders as a literal index card: off-white `#f5f0e8` background, ruled lines, monospace font — contrasting the dark app shell.
- **Front:** 3–5 numbered tasks with checkboxes. Checking a task moves it to the anti-todo.
- **Back (flip):** Anti-todo — a running list of what was actually accomplished today.
- No other UI competes for attention while the card is shown.

### 2. Lists Panel (secondary)
- Three vertical sections: Todo / Watch / Later.
- Inline add input at the top of each list.
- Tasks can be moved between lists via a simple menu.
- Only meaningful action: "→ Add to today's card" (if under 5 tasks).

### 3. Evening Modal (ritual)
Triggered at end of day or manually:
1. Review today's anti-todo (read-only recap).
2. Archive the current card.
3. Pick 3–5 tasks from the lists for tomorrow — ordered by importance.

### 4. Archive Panel (read-only)
- Chronological history of past cards.
- Shows: date, tasks on the card, anti-todo entries.

---

## Component Structure

```
PmarcaTasks.tsx (root, state, persistence)
├── TodayCard       — index card, front/back flip
├── ListsPanel      — three lists, inline add, move between lists
├── EveningModal    — archive + pick-for-tomorrow ritual
└── ArchivePanel    — read-only history
```

---

## Visual Language

- **App shell:** existing dark parchment palette (`#0f0e09` bg, `#c9a84c` gold, Georgia/monospace)
- **Index card:** `#f5f0e8` off-white, ruled lines (`#d4cdb8`), monospace font, drop shadow
- The contrast between the dark shell and the bright card is the core visual metaphor

---

## What Gets Deleted

- Kanban board (three-column todo/in-progress/done layout)
- Priority field (`high` / `medium` / `low`)
- Status field
- Tags
- Due dates
- Filter bar
- View toggle (board/list)

The system's discipline comes from having *less*, not more.
