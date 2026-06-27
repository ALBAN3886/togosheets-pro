export function nowMs() { return Date.now(); }
export function todayIso() { return new Date().toISOString().slice(0,10); }
export function monthIso() { return new Date().toISOString().slice(0,7); }
export function isoFromMs(ms) { return new Date(ms).toISOString(); }
