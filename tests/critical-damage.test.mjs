import assert from "node:assert/strict";
import test from "node:test";
import { movementEffectResult, readMovementEffects, hasMovementDamage, calculateCriticalDamage } from "../module/critical-damage.mjs";

test("crítico normal é 130% e Kokusen é o dobro do mesmo dano original", () => {
  const effects = [movementEffectResult("Dano:", 100)];
  assert.equal(calculateCriticalDamage(effects, false).total, 130);
  assert.equal(calculateCriticalDamage(effects, true).total, 200);
  assert.equal(effects[0].value, 100);
});

test("soma todos os danos antes de arredondar o resultado crítico final", () => {
  const effects = [movementEffectResult("Dano físico:", 2), movementEffectResult("Dano extra:", 2)];
  assert.equal(calculateCriticalDamage(effects, false).base, 4);
  assert.equal(calculateCriticalDamage(effects, false).total, 5);
  assert.equal(calculateCriticalDamage(effects, true).total, 8);
});

test("cura, custo, alcance e textos são preservados sem multiplicação", () => {
  const effects = [movementEffectResult("Dano:", 40), movementEffectResult("Cura:", 30),
    movementEffectResult("Custo:", 10), movementEffectResult("Alcance:", 8), movementEffectResult("Nota:", "Derruba")];
  const result = calculateCriticalDamage(effects, true);
  assert.equal(result.total, 80);
  assert.deepEqual(result.otherEffects.map(entry => entry.value), [30, 10, 8, "Derruba"]);
});

test("efeito numérico sem rótulo e dano zero são reconhecidos; texto literal não é dano", () => {
  for (const label of ["Dano:", "Danos:", "Damage:", "DANO_EXTRA:"]) {
    assert.equal(hasMovementDamage([movementEffectResult(label, 0)]), true);
  }
  const effect = movementEffectResult("Efeito", 40, { unlabeled: true });
  assert.equal(calculateCriticalDamage([effect], false).total, 52);
  assert.equal(calculateCriticalDamage([movementEffectResult("Dano:", 0)], true).total, 0);
  assert.equal(hasMovementDamage([movementEffectResult("Dano:", "40")]), false);
  assert.equal(hasMovementDamage([movementEffectResult("Efeito:", 40)]), false);
});

test("dano manual é opcional e validado sem interpretar fórmulas ou HTML", () => {
  assert.equal(calculateCriticalDamage([], false), null);
  assert.equal(calculateCriticalDamage([], false, ""), null);
  assert.equal(calculateCriticalDamage([], false, "100").total, 130);
  assert.equal(calculateCriticalDamage([], true, 100).total, 200);
  assert.equal(calculateCriticalDamage([], true, "0").total, 0);
  for (const value of [-1, "-1", "a", "1d20", "  ", true, Infinity, NaN, {}]) {
    assert.throws(() => calculateCriticalDamage([], false, value));
  }
  assert.equal(calculateCriticalDamage([movementEffectResult("Dano:", 40)], true, 100).total, 80);
});

test("metadados inválidos são ignorados e o snapshot é uma cópia independente", () => {
  const original = [{ label: "Dano:", kind: "damage", value: 100 },
    { label: "Dano:", kind: "damage", value: "999" }, { label: "Inválido", kind: "damage", value: Infinity }];
  const copy = readMovementEffects(original);
  assert.deepEqual(copy, [original[0]]);
  original[0].value = 900;
  assert.equal(copy[0].value, 100);
  assert.equal(calculateCriticalDamage(copy, true).total, 200);
});
