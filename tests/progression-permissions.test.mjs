import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { validateProgressionChanges } from "../module/progression-permissions.mjs";

let warnings;
beforeEach(() => {
  warnings = [];
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
});
const player = { isGM: false };
const gm = { isGM: true };
const actor = type => ({ type, system: { level: 5, xp: { value: 20 } } });

for (const type of ["character", "curse", "shikigami"]) {
  test(`${type}: jogador não altera XP e nível por campos diretos, mistos ou exclusões`, () => {
    const changes = [
      { "system.level": 6 }, { system: { level: 6 } }, { "system.xp.value": 100 },
      { system: { "xp.value": 100 } }, { "system.xp": { value: 100 } },
      { "system.-=level": null }, { "system.xp.-=value": null },
      { system: { "-=xp": null } }, { "-=system": null }, { system: null },
      { "system.xp": null }, { "system.level": null }
    ];
    for (const change of changes) {
      assert.equal(validateProgressionChanges(actor(type), change, player), false, JSON.stringify(change));
      assert.equal(validateProgressionChanges(actor(type), change, gm), true);
    }
  });
}

test("dados inalterados e alterações dos demais campos continuam permitidos", () => {
  const document = actor("character");
  for (const changes of [{ name: "Novo nome" }, { system: { ea: { value: 10 } } },
    { "system.attributes.forca": 3 }, { "system.level": 5, "system.xp.value": 20 },
    { system: { level: "5", xp: { value: "20" } } }]) {
    assert.equal(validateProgressionChanges(document, changes, player), true);
  }
  assert.deepEqual(warnings, []);
});

test("jogador cria ficha no nível inicial, sem XP adicional nem importação privilegiada", () => {
  const document = { type: "character", system: { level: 1, xp: { value: 0 } } };
  assert.equal(validateProgressionChanges(document, { system: { level: 1, xp: { value: 0 } } }, player, { creating: true }), true);
  assert.equal(validateProgressionChanges(document, { "system.level": 8 }, player, { creating: true }), false);
  assert.equal(validateProgressionChanges(actor("character"), {}, player, { creating: true }), false);
  assert.equal(validateProgressionChanges(actor("character"), {}, gm, { creating: true }), true);
});
