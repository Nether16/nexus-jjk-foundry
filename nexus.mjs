import { NexusCharacterData, NexusCurseData, NexusShikigamiData, NexusItemData } from "./module/data-models.mjs";
import { NexusActor, NexusItem } from "./module/documents.mjs";
import { NexusActorSheet } from "./module/sheets/nexus-actor-sheet.mjs";
import { NEXUS_ATTRIBUTES, NEXUS_ORIGINS } from "./module/config.mjs";
import {
  applyAppearance,
  getWallpaperChoices,
  readAppearance,
  registerAppearanceSettings
} from "./module/sheets/nexus-appearance.mjs";
import { registerRichTextAutosave } from "./module/sheets/nexus-rich-text.mjs";
import { registerTokenPortraitSync } from "./module/token-portraits.mjs";
import { registerMovementMacros } from "./module/movement-macros.mjs";

const NEXUS_LOGO = "systems/nexus-jjk/assets/images/nexus-logo.png";

Hooks.once("init", () => {
  console.log("Nexus JJK | Inicializando sistema para Foundry VTT V14");
  registerAppearanceSettings();
  registerRichTextAutosave();
  registerTokenPortraitSync();
  registerMovementMacros();

  CONFIG.NEXUS = {
    attributes: NEXUS_ATTRIBUTES,
    origins: NEXUS_ORIGINS
  };

  CONFIG.Actor.documentClass = NexusActor;
  CONFIG.Item.documentClass = NexusItem;
  CONFIG.Actor.dataModels = {
    character: NexusCharacterData,
    curse: NexusCurseData,
    shikigami: NexusShikigamiData
  };
  CONFIG.Actor.defaultType = "character";
  CONFIG.Actor.typeLabels = {
    ...CONFIG.Actor.typeLabels,
    character: "TYPES.Actor.character",
    curse: "TYPES.Actor.curse",
    shikigami: "TYPES.Actor.shikigami"
  };
  CONFIG.Item.dataModels = {
    attack: NexusItemData,
    talent: NexusItemData,
    technique: NexusItemData,
    knowledge: NexusItemData,
    equipment: NexusItemData
  };

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["hp", "ea"],
      value: ["level", "defense"]
    },
    curse: {
      bar: ["hp", "ea"],
      value: ["level", "defense"]
    },
    shikigami: {
      bar: ["hp", "ea"],
      value: ["level", "defense"]
    }
  };

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    game.system.id,
    NexusActorSheet,
    {
      types: ["character", "curse", "shikigami"],
      makeDefault: true,
      label: "Nexus"
    }
  );
});

Hooks.once("ready", () => {
  if (game.user.isGM) {
    void getWallpaperChoices({ refresh: true }).catch(error => {
      console.warn("Nexus JJK | Não foi possível atualizar os wallpapers.", error);
    });
  }
});

Hooks.on("renderGamePause", (_app, element) => {
  element.classList.add("nexus-game-pause");

  const logo = element.querySelector("img");
  if (logo) {
    logo.src = foundry.utils.getRoute(NEXUS_LOGO);
    logo.alt = "";
    logo.classList.remove("fa-spin");
  }

  const caption = element.querySelector("figcaption");
  if (caption) caption.textContent = "GAME PAUSED";
});

// Atualiza a aparência sem refazer a ficha ou apagar edições visuais em andamento.
Hooks.on("updateActor", (actor, changes) => {
  const namespace = changes.flags?.["nexus-jjk"];
  if (!namespace || !("appearance" in namespace)) return;
  for (const app of Object.values(actor.apps ?? {})) {
    if (app.element?.classList.contains("nexus-actor-sheet")) {
      applyAppearance(app.element, readAppearance(actor));
    }
  }
});
