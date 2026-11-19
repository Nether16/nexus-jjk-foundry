const GRADE_DAMAGE = 15;
const SPECIAL_DAMAGE = 75;

/** Mantém o dano base salvo e resolve os bônus com o nível e talentos atuais. */
export function getWeaponDamageDetails(item) {
  const actor = item?.actor ?? item?.parent;
  const isWeapon = item?.type === "equipment" && (item.isWeapon ?? item.system?.isWeapon ??
    (Number(item.system?.weaponDamage) > 0 || actor?.system?.equippedWeaponId === item.id));
  const raw = Number(item?.system?.weaponDamage);
  const base = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  if (!isWeapon || actor?.type === "shikigami") {
    return { base, affiliatedBonus: 0, tailoredBonus: 0, total: 0, accuracy: 0, specialAbility: false };
  }

  const level = Math.min(20, Math.max(0, Math.trunc(Number(actor?.system?.level) || 0)));
  const affiliatedSteps = item.system.isAffiliatedWeapon ? Math.floor(level / 5) : 0;
  const affiliatedBonus = affiliatedSteps * GRADE_DAMAGE;
  const hasTailored = actor?.type === "character" && Array.from(actor.items ?? []).some(talent =>
    talent.type === "talent" && talent.name?.replace(/\s*🔒\s*$/u, "").trim() === "Sob Medida");
  const current = base + affiliatedBonus;
  const tailoredBonus = hasTailored ? Math.min(GRADE_DAMAGE, Math.max(0, SPECIAL_DAMAGE - current)) : 0;
  return {
    base,
    affiliatedBonus,
    tailoredBonus,
    total: current + tailoredBonus,
    accuracy: item.system.isAffiliatedWeapon ? 1 + affiliatedSteps : 0,
    specialAbility: hasTailored && current >= SPECIAL_DAMAGE
  };
}
