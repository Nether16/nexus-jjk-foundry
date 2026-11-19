import { getAttributeMax, getXpTarget, NEXUS_MAX_LEVEL, NEXUS_ORIGINS } from "./config.mjs";
import { NEXUS_KNOWLEDGE } from "./knowledge.mjs";
import { getCurseOrigin } from "./curse-config.mjs";

const {
  BooleanField,
  FilePathField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

const numberField = (initial = 0, options = {}) => new NumberField({
  required: true,
  nullable: false,
  initial,
  ...options
});

const stringField = (initial = "") => new StringField({
  required: true,
  nullable: false,
  initial
});

export class NexusCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ienes: stringField(),
      organization: stringField(),
      grade: stringField(),
      level: numberField(1, { integer: true, min: 0, max: NEXUS_MAX_LEVEL }),
      xp: new SchemaField({
        value: numberField(0, { integer: true, min: 0 }),
        target: numberField(100, { integer: true, min: 0, persisted: false })
      }),
      attributes: new SchemaField({
        forca: numberField(0, { integer: true }),
        destreza: numberField(0, { integer: true }),
        agilidade: numberField(0, { integer: true }),
        vigor: numberField(0, { integer: true }),
        percepcao: numberField(0, { integer: true }),
        inteligencia: numberField(0, { integer: true }),
        jujutsu: numberField(0, { integer: true }),
        fdv: numberField(0, { integer: true })
      }),
      hp: new SchemaField({
        value: numberField(150, { integer: true, min: 0 }),
        max: numberField(150, { integer: true, min: 0, persisted: false })
      }),
      ea: new SchemaField({
        value: numberField(150, { integer: true, min: 0 }),
        max: numberField(150, { integer: true, min: 0, persisted: false })
      }),
      movement: numberField(9, { integer: true, persisted: false }),
      defense: numberField(10, { integer: true, persisted: false }),
      attributePoints: numberField(15, { integer: true, persisted: false }),
      attributeMax: numberField(5, { integer: true, min: 0, persisted: false }),
      equippedWeaponId: stringField(),
      origin: new SchemaField({
        key: stringField("feiticeiro"),
        variant: stringField(),
        image: new FilePathField({
          blank: true,
          categories: ["IMAGE", "VIDEO"]
        }),
        description: new HTMLField({ initial: "" }),
        effects: new HTMLField({ initial: "" })
      }),
      knowledgeLevels: new SchemaField(Object.fromEntries(
        Object.keys(NEXUS_KNOWLEDGE).map(key => [
          key,
          numberField(0, { integer: true, min: 0, max: 3 })
        ])
      )),
      history: new HTMLField({ initial: "" }),
      notes: new HTMLField({ initial: "" })
    };
  }

  _getOriginConfig() {
    return NEXUS_ORIGINS[this.origin.key] ?? NEXUS_ORIGINS.feiticeiro;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const origin = this._getOriginConfig();
    const level = Number(this.level) || 0;
    const vigor = Number(this.attributes.vigor) || 0;
    const agilidade = Number(this.attributes.agilidade) || 0;
    const jujutsu = Number(this.attributes.jujutsu) || 0;

    const bonuses = origin.alts?.[this.origin.variant]?.bonuses;
    const hpBase = origin.hpMultiplier === 100 ? 200 : 100;
    const extraHpPerLevel = (bonuses?.hpMultiplier ?? origin.hpMultiplier) - origin.hpMultiplier;
    const levelsAfterFirst = Math.max(level - 1, 0);
    const eaBase = origin.eaMultiplier === 100 ? 200 : 100;

    this.hp.max = hpBase + (level * origin.hpMultiplier) + (vigor * 10)
      + (bonuses?.hpInitial ?? 0) + (levelsAfterFirst * extraHpPerLevel);
    this.ea.max = origin.hasEA
      ? eaBase + (level * origin.eaMultiplier) + (jujutsu * 10)
      : 0;

    this.hp.value = Math.min(Math.max(Number(this.hp.value) || 0, 0), this.hp.max);
    this.ea.value = Math.min(Math.max(Number(this.ea.value) || 0, 0), this.ea.max);
    this.movement = 9 + agilidade;
    this.defense = 10 + agilidade + Math.floor(vigor / 2);

    const spent = [
      this.attributes.forca,
      this.attributes.destreza,
      this.attributes.agilidade,
      this.attributes.vigor,
      this.attributes.percepcao,
      this.attributes.inteligencia,
      this.attributes.jujutsu,
      this.attributes.fdv
    ].reduce(
      (total, value) => total + (Number(value) || 0),
      0
    );

    this.attributePoints = 10 + (level * 5) - spent;
    this.attributeMax = getAttributeMax(level);
    this.xp.target = getXpTarget(level);
  }
}

/** Compartilha a ficha base, usando os graus e multiplicadores das maldições. */
export class NexusCurseData extends NexusCharacterData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.origin = new SchemaField({
      key: stringField("grau4"),
      variant: stringField(),
      image: new FilePathField({ blank: true, categories: ["IMAGE", "VIDEO"] }),
      description: new HTMLField({ initial: "" }),
      effects: new HTMLField({ initial: "" })
    });
    schema.hp = new SchemaField({
      value: numberField(150, { integer: true, min: 0 }),
      max: numberField(175, { integer: true, min: 0, persisted: false })
    });
    schema.ea = new SchemaField({
      value: numberField(150, { integer: true, min: 0 }),
      max: numberField(175, { integer: true, min: 0, persisted: false })
    });
    return schema;
  }

  _getOriginConfig() {
    return getCurseOrigin(this.origin.key);
  }
}

export class NexusItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ initial: "" }),
      attack: stringField(),
      cost: stringField(),
      effect: stringField(),
      isWeapon: new BooleanField({ required: true, nullable: true, initial: null }),
      weaponDamage: numberField(0, { min: 0 }),
      quantity: numberField(1, { integer: true, min: 0 }),
      locked: new BooleanField({ required: true, nullable: false, initial: false })
    };
  }
}
