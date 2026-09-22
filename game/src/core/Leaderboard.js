/**
 * Speedrun board. Always keeps a local top ten so the game works offline and
 * on a laptop at a party with no signal. If Supabase credentials are present
 * in the build environment it also syncs a shared board.
 *
 * To turn on the shared board, create .env with:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 * and create the table (SQL is in the project README).
 */

const LOCAL_KEY = 'aast2026:scores:v1';
const LIMIT = 10;

const URL_BASE = import.meta.env?.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
export const remoteEnabled = Boolean(URL_BASE && ANON_KEY);

const byTime = (a, b) => a.timeMs - b.timeMs;

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, LIMIT)));
  } catch {
    /* storage blocked — the run still counts for this session */
  }
}

export function localTop(n = LIMIT) {
  return readLocal().sort(byTime).slice(0, n);
}

function addLocal(entry) {
  const rows = readLocal();
  rows.push(entry);
  rows.sort(byTime);
  writeLocal(rows);
  return rows.slice(0, LIMIT);
}

async function remoteRequest(path, options = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** Submit a finished run. Never throws — a dead network must not eat the win. */
export async function submit(entry) {
  const row = {
    name: String(entry.name || 'Engineer').slice(0, 24),
    time_ms: Math.round(entry.timeMs),
    gpa: Number(entry.gpa) || 0,
    met: Number(entry.met) || 0,
  };
  addLocal({ name: row.name, timeMs: row.time_ms, gpa: row.gpa, met: row.met, at: Date.now() });
  if (!remoteEnabled) return { synced: false, reason: 'local-only' };
  try {
    await remoteRequest('runs', { method: 'POST', body: JSON.stringify(row) });
    return { synced: true };
  } catch (err) {
    return { synced: false, reason: err.message };
  }
}

/** Best runs, remote if configured and reachable, otherwise local. */
export async function top(n = LIMIT) {
  if (remoteEnabled) {
    try {
      const rows = await remoteRequest(
        `runs?select=name,time_ms,gpa,met&order=time_ms.asc&limit=${n}`
      );
      if (Array.isArray(rows)) {
        return {
          source: 'global',
          rows: rows.map((r) => ({ name: r.name, timeMs: r.time_ms, gpa: r.gpa, met: r.met })),
        };
      }
    } catch {
      /* fall through to local */
    }
  }
  return { source: 'local', rows: localTop(n) };
}
