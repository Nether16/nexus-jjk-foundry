/** Guarda o resultado já resolvido, sem avaliar a fórmula novamente no crítico. */
export function movementEffectResult(label, value, { unlabeled = false } = {}) {
  const title = String(label ?? "").trim() || "Efeito";
  const numeric = typeof value === "number" && Number.isFinite(value);
  const damage = unlabeled || /^(?:danos?|damage)(?:\b|[\s:_-])/iu.test(title);
  return { label: title, kind: numeric ? (damage ? "damage" : "number") : "text", value };
}

export function readMovementEffects(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && typeof entry.label === "string" &&
    ((["damage", "number"].includes(entry.kind) && typeof entry.value === "number" && Number.isFinite(entry.value)) ||
      (entry.kind === "text" && typeof entry.value === "string")))
    .map(({ label, kind, value }) => ({ label, kind, value }));
}

export function hasMovementDamage(effects) {
  return readMovementEffects(effects).some(entry => entry.kind === "damage" && entry.value >= 0);
}

/** Arredonda apenas o dano total final; 130% é calculado como 13/10. */
export function calculateCriticalDamage(effects, success, manualDamage) {
  const entries = readMovementEffects(effects);
  let components = entries.filter(entry => entry.kind === "damage" && entry.value >= 0);
  if (!components.length && manualDamage !== undefined && manualDamage !== null && manualDamage !== "") {
    if (!["string", "number"].includes(typeof manualDamage) || String(manualDamage).trim() === "") {
      throw new Error("Informe um dano base igual ou maior que zero.");
    }
    const value = Number(manualDamage);
    if (!Number.isFinite(value) || value < 0) throw new Error("Informe um dano base igual ou maior que zero.");
    components = [{ label: "Dano", kind: "damage", value: Math.floor(value) }];
  }
  if (!components.length) return null;
  const base = components.reduce((total, entry) => total + entry.value, 0);
  const total = Math.floor(base * (success ? 20 : 13) / 10);
  if (!Number.isFinite(total)) throw new Error("O dano calculado está fora do intervalo permitido.");
  return { base, total, multiplier: success ? 2 : 1.3, components,
    otherEffects: entries.filter(entry => entry.kind !== "damage") };
}
