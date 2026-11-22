# Betyársors – Foundry VTT game system

Game system skeleton for Foundry VTT v14. Technical structure follows
[Vacuum of the Void](https://github.com/efferanevem/vacuum-of-the-void-foundry-vtt); rules are separate.
Rule-dependent spots are marked `TODO(szabály)`.

## Layout

| Path | Purpose |
| --- | --- |
| `system.json` | System manifest (id `betyarsors`, document types) |
| `src/betyarsors.mjs` | Entry point: data models, sheets, chat hooks, `game.betyarsors` API |
| `module/config.mjs` | `SYSTEM_ID`, paths, `CONFIG.BETYARSORS` (rule constants) |
| `module/data-models/` | `CreatureDataModel` (shared) → `Karakter`, `Npc`; items `Fortely`, `Fegyver`, `Ruha`, `Targy` |
| `module/documents/` | `creature-sheet` (shared) → Karakter / NJK sheets; shared item sheet; roll dialog |
| `templates/actor/parts/` | Shared sheet partials (attributes, equipment, fortélyok, reputation, notes…), registered as `betyarsors.*` |
| `module/util/roll.mjs` | `rollCheck()` – single entry point for rolls → chat |
| `module/util/result-type.mjs` | Fate Die extremes: max → +1 Sorspont, 1 → +1 Végzet |
| `module/util/chat.mjs` | `renderChatMessageHTML` decoration from chat flags |
| `module/apps/doom-tracker.mjs` | Végzet counter (world setting, GM-only widget; auto +1 on a player's Fate Die 1) |
| `templates/actor`, `templates/item`, `templates/app` | Handlebars templates |
| `styles/` | `main.css` imports variables → sheets → chat |
| `lang/hu.json` | Hungarian strings (the system is Hungarian-only; both `hu` and `en` load this file) |
| `scripts/link.ps1` | Links the repo into Foundry's `Data/systems` |

## Roll flow

Check = Sorskocka (attribute die; Előny: 2 dice keep highest, Hátrány: keep lowest)
+ skill value × d4 + gear dice × d6 (max 3) + modifier. No target number: success is judged by the GM.
Roll mode (Hátrány / Normál / Előny) is chosen in the dialog; a "Sebesült" column preselects Hátrány.

```
sheet [data-action="roll" data-roll-type="skill|attribute" data-key]  /  weapon row [itemRoll]
  → openRollSheet()       module/documents/roll-sheet.mjs  (roll mode, gear dice, modifier)
  → rollCheck()           module/util/roll.mjs             (formula, evaluate, +1 Sorspont, toMessage)
  → computeResultType()   module/util/result-type.mjs      (flags.betyarsors.resultType)
  → renderChatMessageHTML module/util/chat.mjs             (Sorspont, Végzet)
```

Macro: `game.betyarsors.openRollSheet(actor, { type: "skill", key: "lovaglas" })`.

Skill progress (FP): when a skill's FP reaches 2 × (value + 1), the value increases automatically
(max 5); leftover FP carries over (`KarakterDataModel._preUpdate`).

## Adding a document type

1. Add the key to `system.json` → `documentTypes.Actor` / `documentTypes.Item`.
2. Data model in `module/data-models/` (extend the base model), export from `index.mjs`.
3. Sheet in `module/documents/` (extend `BetyarsorsActorSheet` / `BetyarsorsItemSheet`),
   template in `templates/`, export from `module/documents.mjs`.
4. Register both in `src/betyarsors.mjs`.
5. Add `TYPES.<Doc>.<Key>` and sheet label to the language files.

## Local development

1. Link the repo into Foundry (once): `npm run link`
   → junction `%LOCALAPPDATA%\FoundryVTT\Data\systems\betyarsors` → this repository.
   Other data path: `powershell -File scripts/link.ps1 -DataPath "D:\FoundryData"`.
2. Restart Foundry and create a world using the **Betyársors** game system.
3. Edit files and reload the browser (F5). Changes to `system.json` require a Foundry restart.

Foundry loads `src/` directly, so no build step is needed. `npm run build` produces an optional
Vite bundle in `dist/`.
