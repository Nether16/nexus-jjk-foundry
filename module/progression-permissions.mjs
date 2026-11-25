/** Detecta campos protegidos, inclusive caminhos mistos e remoções de seus pais. */
function changesForPath(changes, target, prefix = []) {
  const matches = [];
  for (const [key, value] of Object.entries(changes ?? {})) {
    const parts = [...prefix, ...key.split(".")];
    const canonical = parts.map(part => part.startsWith("-=") ? part.slice(2) : part);
    if (!canonical.slice(0, Math.min(canonical.length, target.length))
      .every((part, index) => part === target[index])) continue;
    const deleted = parts.some(part => part.startsWith("-="));
    if (deleted && canonical.length <= target.length) matches.push(undefined);
    else if (canonical.length === target.length) matches.push(value);
    else if (canonical.length < target.length && value && typeof value === "object" && !Array.isArray(value)) {
      matches.push(...changesForPath(value, target, parts));
    } else matches.push(undefined);
  }
  return matches;
}

/** XP e nível são administrados pelo mestre; os demais campos continuam editáveis. */
export function validateProgressionChanges(actor, changes, user, { creating = false } = {}) {
  if (user?.isGM || !["character", "curse", "shikigami"].includes(actor.type)) return true;
  const protectedFields = [
    { path: ["system", "level"], current: actor.system.level, initial: actor.type === "shikigami" ? null : 1 },
    { path: ["system", "xp", "value"], current: actor.system.xp?.value, initial: 0 }
  ];
  for (const { path, current, initial } of protectedFields) {
    const expected = creating ? initial : current;
    const values = changesForPath(changes, path);
    if (creating && current !== undefined) values.push(current);
    for (const value of values) {
      if (value === expected) continue;
      if (typeof value === "string" && value.trim() && Number(value) === expected) continue;
      globalThis.ui?.notifications?.warn("Apenas o mestre pode alterar XP e nível.");
      return false;
    }
  }
  return true;
}
