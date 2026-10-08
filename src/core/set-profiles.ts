// Gerado por tools/build_profiles.py a partir de
// specs/001-pokemon-booster-opener/pull-rates.json — não editar à mão.
import type { BoosterProfile } from './distributions.js';

export const RESEARCHED_PROFILES: Readonly<Record<string, BoosterProfile>> = {
  // Real English 30th Celebration pack = 5 game cards + 1 foil Basic Energy: Common, Common, Common-or-hit (Illustration Rare or a Classic Collection reprint), rare slot (Rare / Double Rare / Special Illustration Rare / Futuristic Rare / RGB Rare), Pikachu Rare, foil Basic Energy.
  "me55": {
    keepOrder: true,
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 0.71, rarities: ["Common"] },
        { p: 0.19, rarities: ["Illustration Rare"] },
        { p: 0.1, subset: "me55c" },
      ],
      [
        { p: 0.689, rarities: ["Rare"] },
        { p: 0.25, rarities: ["Double Rare"] },
        { p: 0.05, rarities: ["Special Illustration Rare"] },
        { p: 0.01, rarities: ["Futuristic Rare"] },
        { p: 0.001, rarities: ["RGB Rare"] },
      ],
      [
        { p: 1, rarities: ["Pikachu Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "me5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.8765, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.1101, rarities: ["Illustration Rare"] },
        { p: 0.0125, rarities: ["Special Illustration Rare"] },
        { p: 0.0009, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.7068, rarities: ["Rare"] },
        { p: 0.2102, rarities: ["Double Rare"] },
        { p: 0.083, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "me4": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.875673, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.111111, rarities: ["Illustration Rare"] },
        { p: 0.012346, rarities: ["Special Illustration Rare"] },
        { p: 0.00087, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.716667, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.083333, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "me3": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.875983, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.111111, rarities: ["Illustration Rare"] },
        { p: 0.012346, rarities: ["Special Illustration Rare"] },
        { p: 0.00056, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.716667, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.083333, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare / Mega Attack Rare), then the Basic Energy. MAR replaces the Ultra Rare in the rare slot.
  "me2pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.872751, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.111111, rarities: ["Illustration Rare"] },
        { p: 0.014286, rarities: ["Special Illustration Rare"] },
        { p: 0.001852, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.717898, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.047619, rarities: ["Ultra Rare"] },
        { p: 0.034483, rarities: ["MEGA_ATTACK_RARE"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "me2": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.875595, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.111111, rarities: ["Illustration Rare"] },
        { p: 0.0125, rarities: ["Special Illustration Rare"] },
        { p: 0.000794, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.716667, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.083333, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English ME pack = 10 game cards + 1 Basic Energy (+ TCG Live code card, not counted): 4 Common, 3 Uncommon, 1 reverse holo (Poke Ball/Master Ball pattern, any C/U/R), 1 reverse holo that can be replaced by Illustration Rare / Special Illustration Rare / Mega Hyper Rare, 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "me1": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.878194, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.111111, rarities: ["Illustration Rare"] },
        { p: 0.009901, rarities: ["Special Illustration Rare"] },
        { p: 0.000794, rarities: ["Mega Hyper Rare"] },
      ],
      [
        { p: 0.716667, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.083333, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Black Bolt, ETB/collection-only): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (reverse / Poké Ball-pattern ~1/3), reverse #2 (reverse / Master Ball-pattern ~1/19, or Illustration Rare / SIR / Black White Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "zsv10pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.819833, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.166667, rarities: ["Illustration Rare"] },
        { p: 0.0125, rarities: ["Special Illustration Rare"] },
        { p: 0.001, rarities: ["Black White Rare"] },
      ],
      [
        { p: 0.730206, rarities: ["Rare"] },
        { p: 0.21097, rarities: ["Double Rare"] },
        { p: 0.058824, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (White Flare, ETB/collection-only): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (reverse / Poké Ball-pattern ~1/3), reverse #2 (reverse / Master Ball-pattern ~1/19, or Illustration Rare / SIR / Black White Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "rsv10pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.819833, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.166667, rarities: ["Illustration Rare"] },
        { p: 0.0125, rarities: ["Special Illustration Rare"] },
        { p: 0.001, rarities: ["Black White Rare"] },
      ],
      [
        { p: 0.730206, rarities: ["Rare"] },
        { p: 0.21097, rarities: ["Double Rare"] },
        { p: 0.058824, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Destined Rivals): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (no ACE SPEC in this set), reverse #2 (or Illustration Rare / SIR / Hyper Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "sv10": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.899318, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.083333, rarities: ["Illustration Rare"] },
        { p: 0.010638, rarities: ["Special Illustration Rare"] },
        { p: 0.006711, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.7375, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Double Rare"] },
        { p: 0.0625, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Journey Together): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (no ACE SPEC in this set), reverse #2 (or Illustration Rare / SIR / Hyper Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "sv9": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.896354, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.084746, rarities: ["Illustration Rare"] },
        { p: 0.011601, rarities: ["Special Illustration Rare"] },
        { p: 0.007299, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.765149, rarities: ["Rare"] },
        { p: 0.169492, rarities: ["Double Rare"] },
        { p: 0.065359, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Prismatic Evolutions): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (Poké Ball-pattern reverse, or ACE SPEC Rare), reverse #2 (reverse / Master Ball-pattern reverse, or SIR/Hyper Rare; no Illustration Rares in this set), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "sv8pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.952381, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.047619, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.972222, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.022222, rarities: ["Special Illustration Rare"] },
        { p: 0.005556, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.770833, rarities: ["Rare"] },
        { p: 0.166667, rarities: ["Double Rare"] },
        { p: 0.0625, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Surging Sparks): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (or ACE SPEC Rare), reverse #2 (or Illustration Rare / SIR / Hyper Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "sv8": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.949749, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.050251, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.906284, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923, rarities: ["Illustration Rare"] },
        { p: 0.011494, rarities: ["Special Illustration Rare"] },
        { p: 0.005299, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.76294, rarities: ["Rare"] },
        { p: 0.169492, rarities: ["Double Rare"] },
        { p: 0.067568, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack (Stellar Crown): 10 game cards + 1 Basic Energy (+code card) = 4 Common, 3 Uncommon, reverse #1 (or ACE SPEC Rare), reverse #2 (or Illustration Rare / SIR / Hyper Rare), 1 rare slot (Rare / Double Rare / Ultra Rare), Basic Energy.
  "sv7": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.950495, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.049505, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.903465, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.078125, rarities: ["Illustration Rare"] },
        { p: 0.011111, rarities: ["Special Illustration Rare"] },
        { p: 0.007299, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.76294, rarities: ["Rare"] },
        { p: 0.169492, rarities: ["Double Rare"] },
        { p: 0.067568, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy. Reverse slot 1 can be replaced by an ACE SPEC Rare (~1/20). (estimativa)
  "sv6pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.95, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.05, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.894796849089, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.083333333333, rarities: ["Illustration Rare"] },
        { p: 0.014925373134, rarities: ["Special Illustration Rare"] },
        { p: 0.006944444444, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy. Reverse slot 1 can be replaced by an ACE SPEC Rare (~1/20).
  "sv6": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.95, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.05, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.904599701032, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.011627906977, rarities: ["Special Illustration Rare"] },
        { p: 0.006849315068, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy. Reverse slot 1 can be replaced by an ACE SPEC Rare (~1/20).
  "sv5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.95, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.05, rarities: ["ACE SPEC Rare"] },
      ],
      [
        { p: 0.904254771496, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.011627906977, rarities: ["Special Illustration Rare"] },
        { p: 0.007194244604, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy. Reverse slot 1 can be replaced by Shiny Rare (1/4) or Shiny Ultra Rare (1/13) (confirmed by cardcodex reverse-holo totals: ~1.56 reverses/pack).
  "sv4pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.673076923077, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.25, rarities: ["Shiny Rare"] },
        { p: 0.076923076923, rarities: ["Shiny Ultra Rare"] },
      ],
      [
        { p: 0.895201017003, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.071428571429, rarities: ["Illustration Rare"] },
        { p: 0.01724137931, rarities: ["Special Illustration Rare"] },
        { p: 0.016129032258, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "sv4": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.889605205381, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.021276595745, rarities: ["Special Illustration Rare"] },
        { p: 0.012195121951, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "sv3pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.86580882353, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.083333333333, rarities: ["Illustration Rare"] },
        { p: 0.03125, rarities: ["Special Illustration Rare"] },
        { p: 0.019607843137, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.8125, rarities: ["Rare"] },
        { p: 0.125, rarities: ["Double Rare"] },
        { p: 0.0625, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "sv3": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.873308404558, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.03125, rarities: ["Special Illustration Rare"] },
        { p: 0.018518518519, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.766666666666, rarities: ["Rare"] },
        { p: 0.166666666667, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "sv2": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.874283063428, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.03125, rarities: ["Special Illustration Rare"] },
        { p: 0.017543859649, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.790476190476, rarities: ["Rare"] },
        { p: 0.142857142857, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card, not counted): 4 Commons, 3 Uncommons, 2 reverse-holo slots (2nd can become Illustration Rare / Special Illustration Rare / Hyper Rare), 1 rare slot (Rare, or Double Rare / Ultra Rare), then the Basic Energy.
  "sv1": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare"] },
      ],
      [
        { p: 0.872958998549, rarities: ["Common", "Uncommon", "Rare"] },
        { p: 0.076923076923, rarities: ["Illustration Rare"] },
        { p: 0.03125, rarities: ["Special Illustration Rare"] },
        { p: 0.018867924528, rarities: ["Hyper Rare"] },
      ],
      [
        { p: 0.790476190476, rarities: ["Rare"] },
        { p: 0.142857142857, rarities: ["Double Rare"] },
        { p: 0.066666666667, rarities: ["Ultra Rare"] },
      ],
      [
        { p: 1, subset: "sve" },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card): 5 Commons, 3 Uncommons, 1 reverse holo, 1 rare-or-better. A Radiant Rare replaces one Common (modelled in the 5th Common slot). Galarian Gallery (swsh12pt5gg) cards replace the reverse holo. Energy omitted (no SWSH energy images in data).
  "swsh12pt5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 0.954545, rarities: ["Common"] },
        { p: 0.045455, rarities: ["Radiant Rare"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.649839, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.222222, rarities: ["Trainer Gallery Rare Holo"], subset: "swsh12pt5gg" },
        { p: 0.037453, rarities: ["Rare Ultra"], subset: "swsh12pt5gg" },
        { p: 0.037453, rarities: ["Rare Holo VSTAR"], subset: "swsh12pt5gg" },
        { p: 0.033784, rarities: ["Rare Holo V"], subset: "swsh12pt5gg" },
        { p: 0.011249, rarities: ["Rare Holo VMAX"], subset: "swsh12pt5gg" },
        { p: 0.008, rarities: ["Rare Secret"], subset: "swsh12pt5gg" },
      ],
      [
        { p: 0.60904, rarities: ["Rare"] },
        { p: 0.178571, rarities: ["Rare Holo"] },
        { p: 0.123457, rarities: ["Rare Holo V"] },
        { p: 0.032573, rarities: ["Rare Holo VSTAR"] },
        { p: 0.02849, rarities: ["Rare Ultra"] },
        { p: 0.020367, rarities: ["Rare Holo VMAX"] },
        { p: 0.007502, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card): 5 Commons, 3 Uncommons, 1 reverse holo, 1 rare-or-better. A Radiant Rare replaces one Common (modelled in the 5th Common slot). Trainer Gallery (swsh12tg) cards replace the reverse holo. Energy omitted (no SWSH energy images in data).
  "swsh12": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 0.94898, rarities: ["Common"] },
        { p: 0.05102, rarities: ["Radiant Rare"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.874722, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.083333, rarities: ["Trainer Gallery Rare Holo"], subset: "swsh12tg" },
        { p: 0.013495, rarities: ["Rare Holo V"], subset: "swsh12tg" },
        { p: 0.011574, rarities: ["Rare Ultra"], subset: "swsh12tg" },
        { p: 0.009166, rarities: ["Rare Secret"], subset: "swsh12tg" },
        { p: 0.00771, rarities: ["Rare Holo VMAX"], subset: "swsh12tg" },
      ],
      [
        { p: 0.610297, rarities: ["Rare"] },
        { p: 0.178571, rarities: ["Rare Holo"] },
        { p: 0.114943, rarities: ["Rare Holo V"] },
        { p: 0.037037, rarities: ["Rare Ultra"] },
        { p: 0.031847, rarities: ["Rare Holo VSTAR"] },
        { p: 0.012594, rarities: ["Rare Rainbow"] },
        { p: 0.009398, rarities: ["Rare Secret"] },
        { p: 0.005313, rarities: ["Rare Holo VMAX"] },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card): 5 Commons, 3 Uncommons, 1 reverse holo, 1 rare-or-better. A Radiant Rare replaces one Common (modelled in the 5th Common slot). Trainer Gallery (swsh11tg) cards replace the reverse holo. Energy omitted (no SWSH energy images in data).
  "swsh11": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 0.95, rarities: ["Common"] },
        { p: 0.05, rarities: ["Radiant Rare"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.875918, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.08547, rarities: ["Trainer Gallery Rare Holo"], subset: "swsh11tg" },
        { p: 0.012121, rarities: ["Rare Holo V"], subset: "swsh11tg" },
        { p: 0.010395, rarities: ["Rare Ultra"], subset: "swsh11tg" },
        { p: 0.009166, rarities: ["Rare Secret"], subset: "swsh11tg" },
        { p: 0.00693, rarities: ["Rare Holo VMAX"], subset: "swsh11tg" },
      ],
      [
        { p: 0.601493, rarities: ["Rare"] },
        { p: 0.178571, rarities: ["Rare Holo"] },
        { p: 0.116279, rarities: ["Rare Holo V"] },
        { p: 0.039062, rarities: ["Rare Ultra"] },
        { p: 0.037879, rarities: ["Rare Holo VSTAR"] },
        { p: 0.012804, rarities: ["Rare Rainbow"] },
        { p: 0.007599, rarities: ["Rare Secret"] },
        { p: 0.006313, rarities: ["Rare Holo VMAX"] },
      ],
    ],
  },
  // Pokemon GO (SWSH): 10 game cards = 5 commons, 3 uncommons, 1 reverse holo (replaced by a Radiant Rare ~1 in 17), 1 rare slot (always at least Rare Holo) + 1 Basic Energy (energy omitted).
  "pgo": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.941176, rarities: ["Common", "Uncommon", "Rare Holo"] },
        { p: 0.058824, rarities: ["Radiant Rare"] },
      ],
      [
        { p: 0.696206, rarities: ["Rare Holo"] },
        { p: 0.166667, rarities: ["Rare Holo V"] },
        { p: 0.051546, rarities: ["Rare Ultra"] },
        { p: 0.02584, rarities: ["Rare Rainbow"] },
        { p: 0.025, rarities: ["Rare Holo VSTAR"] },
        { p: 0.018868, rarities: ["Rare Holo VMAX"] },
        { p: 0.015873, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Astral Radiance: 10 cards = 5 commons, 3 uncommons, 1 reverse holo slot (replaced by a Trainer Gallery card ~1 in 8 or a Radiant Rare ~1 in 20), 1 rare slot (Rare / Holo / V / VSTAR / VMAX / full art & alt art / rainbow / gold). Plus 1 Basic Energy and a code card (not modelled).
  "swsh10": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.823349, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.087719, rarities: ["Trainer Gallery Rare Holo"], subset: "swsh10tg" },
        { p: 0.049751, rarities: ["Radiant Rare"] },
        { p: 0.017668, rarities: ["Rare Holo V"], subset: "swsh10tg" },
        { p: 0.009814, rarities: ["Rare Ultra"], subset: "swsh10tg" },
        { p: 0.007776, rarities: ["Rare Secret"], subset: "swsh10tg" },
        { p: 0.003923, rarities: ["Rare Holo VMAX"], subset: "swsh10tg" },
      ],
      [
        { p: 0.601763, rarities: ["Rare"] },
        { p: 0.175439, rarities: ["Rare Holo"] },
        { p: 0.128205, rarities: ["Rare Holo V"] },
        { p: 0.039526, rarities: ["Rare Ultra"] },
        { p: 0.026954, rarities: ["Rare Holo VSTAR"] },
        { p: 0.012804, rarities: ["Rare Rainbow"] },
        { p: 0.00771, rarities: ["Rare Holo VMAX"] },
        { p: 0.007599, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card): 5 Commons, 3 Uncommons, 1 reverse holo, 1 rare-or-better. Trainer Gallery (swsh9tg) cards replace the reverse holo. Energy omitted (no SWSH energy images in data).
  "swsh9": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.870338, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.087719, rarities: ["Trainer Gallery Rare Holo"], subset: "swsh9tg" },
        { p: 0.012285, rarities: ["Rare Holo V"], subset: "swsh9tg" },
        { p: 0.010246, rarities: ["Rare Holo VMAX"], subset: "swsh9tg" },
        { p: 0.010246, rarities: ["Rare Ultra"], subset: "swsh9tg" },
        { p: 0.009166, rarities: ["Rare Secret"], subset: "swsh9tg" },
      ],
      [
        { p: 0.583626, rarities: ["Rare"] },
        { p: 0.175439, rarities: ["Rare Holo"] },
        { p: 0.142857, rarities: ["Rare Holo V"] },
        { p: 0.041152, rarities: ["Rare Ultra"] },
        { p: 0.023256, rarities: ["Rare Holo VSTAR"] },
        { p: 0.014706, rarities: ["Rare Rainbow"] },
        { p: 0.010417, rarities: ["Rare Holo VMAX"] },
        { p: 0.008547, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Fusion Strike: 10 cards = 5 commons, 3 uncommons, 1 reverse holo, 1 rare slot (Rare / Holo / V / VMAX / full art & alt art / rainbow / gold). Plus 1 Basic Energy and a code card (not modelled).
  "swsh8": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
      ],
      [
        { p: 0.635927, rarities: ["Rare"] },
        { p: 0.178571, rarities: ["Rare Holo"] },
        { p: 0.09009, rarities: ["Rare Holo V"] },
        { p: 0.038462, rarities: ["Rare Ultra"] },
        { p: 0.037736, rarities: ["Rare Holo VMAX"] },
        { p: 0.010881, rarities: ["Rare Rainbow"] },
        { p: 0.008333, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Celebrations: 4 game cards, all holo, no commons/uncommons: 3 main-set non-V holos + 1 hit slot that is a Classic Collection reprint (~1/2.5), a V (~1/2.8), VMAX (~1/13), full-art Professor's Research (1/25), gold Mew (~1/150), else another main-set holo.
  "cel25": {
    slots: [
      [
        { p: 1, rarities: ["Rare", "Rare Holo"] },
      ],
      [
        { p: 1, rarities: ["Rare", "Rare Holo"] },
      ],
      [
        { p: 1, rarities: ["Rare", "Rare Holo"] },
      ],
      [
        { p: 0.4, rarities: ["Classic Collection"], subset: "cel25c" },
        { p: 0.35714285714285715, rarities: ["Rare Holo V"] },
        { p: 0.11926739926739927, rarities: ["Rare", "Rare Holo"] },
        { p: 0.07692307692307693, rarities: ["Rare Holo VMAX"] },
        { p: 0.04, rarities: ["Rare Ultra"] },
        { p: 0.006666666666666667, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (+ code card): 5 Commons, 3 Uncommons, 1 reverse holo, 1 rare-or-better. No Trainer Gallery; the reverse slot is always a main-set reverse holo. Energy omitted (no SWSH energy images in data).
  "swsh7": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
      ],
      [
        { p: 0.597791, rarities: ["Rare"] },
        { p: 0.181818, rarities: ["Rare Holo"] },
        { p: 0.105263, rarities: ["Rare Holo V"] },
        { p: 0.055866, rarities: ["Rare Holo VMAX"] },
        { p: 0.03876, rarities: ["Rare Ultra"] },
        { p: 0.011403, rarities: ["Rare Rainbow"] },
        { p: 0.009099, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Shining Fates: 10 game cards = 5 commons, 3 uncommons, 1 reverse-holo slot (replaced by a Shiny Vault card ~33% of packs), 1 rare slot (Rare/Holo/V/VMAX/Amazing/full art/rainbow) + 1 Basic Energy (energy omitted).
  "swsh45": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.673907, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.227273, rarities: ["Rare Shiny"], subset: "swsh45sv" },
        { p: 0.050505, rarities: ["Rare Holo V"], subset: "swsh45sv" },
        { p: 0.039216, rarities: ["Rare Holo VMAX"], subset: "swsh45sv" },
        { p: 0.009099, rarities: ["Rare Secret"], subset: "swsh45sv" },
      ],
      [
        { p: 0.556541, rarities: ["Rare"] },
        { p: 0.178571, rarities: ["Rare Holo"] },
        { p: 0.108696, rarities: ["Rare Holo V"] },
        { p: 0.057471, rarities: ["Amazing Rare"] },
        { p: 0.054348, rarities: ["Rare Holo VMAX"] },
        { p: 0.032468, rarities: ["Rare Ultra"] },
        { p: 0.011905, rarities: ["Rare Rainbow"] },
      ],
    ],
  },
  // Vivid Voltage: 10 cards = 5 commons, 3 uncommons, 1 reverse holo, 1 rare slot (Rare / Holo / V / Amazing Rare / VMAX / full art / rainbow / gold). Plus 1 Basic Energy and a code card (not modelled).
  "swsh4": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
      ],
      [
        { p: 0.492478, rarities: ["Rare"] },
        { p: 0.217391, rarities: ["Rare Holo"] },
        { p: 0.126582, rarities: ["Rare Holo V"] },
        { p: 0.057143, rarities: ["Amazing Rare"] },
        { p: 0.042918, rarities: ["Rare Holo VMAX"] },
        { p: 0.039683, rarities: ["Rare Ultra"] },
        { p: 0.012706, rarities: ["Rare Rainbow"] },
        { p: 0.011099, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Champion's Path (special set): 10 cards = 5 commons, 3 uncommons, 1 reverse holo, 1 rare slot that is ALWAYS at least Rare Holo (no plain Rares); hits V / VMAX / full art / rainbow / gold replace the holo. Plus 1 Basic Energy and a code card (not modelled).
  "swsh35": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare Holo"] },
      ],
      [
        { p: 0.725634, rarities: ["Rare Holo"] },
        { p: 0.15625, rarities: ["Rare Holo V"] },
        { p: 0.053763, rarities: ["Rare Ultra"] },
        { p: 0.035461, rarities: ["Rare Holo VMAX"] },
        { p: 0.015699, rarities: ["Rare Rainbow"] },
        { p: 0.013193, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Cosmic Eclipse: 10 cards = 5 commons, 3 uncommons, 1 reverse holo slot (replaced by a Character Rare ~1 in 10 packs), 1 rare slot (Rare / Holo / GX & Tag Team GX / full art / rainbow / gold). Plus 1 Basic Energy and a code card (not modelled).
  "sm12": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.9, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.1, rarities: ["Character Rare"] },
      ],
      [
        { p: 0.665692, rarities: ["Rare"] },
        { p: 0.144928, rarities: ["Rare Holo"] },
        { p: 0.128205, rarities: ["Rare Holo GX"] },
        { p: 0.038168, rarities: ["Rare Ultra"] },
        { p: 0.014006, rarities: ["Rare Rainbow"] },
        { p: 0.009001, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Hidden Fates: 10 game cards = 5 commons, 3 uncommons, 1 reverse-holo slot (replaced by a Shiny Vault card ~39% of packs), 1 rare slot (Rare / Holo / GX / full art / rainbow) + 1 Basic Energy (energy omitted).
  "sm115": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.607646, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
        { p: 0.25, rarities: ["Rare Shiny"], subset: "sma" },
        { p: 0.111111, rarities: ["Rare Shiny GX"], subset: "sma" },
        { p: 0.013699, rarities: ["Rare Ultra"], subset: "sma" },
        { p: 0.017544, rarities: ["Rare Secret"], subset: "sma" },
      ],
      [
        { p: 0.43, rarities: ["Rare"] },
        { p: 0.28, rarities: ["Rare Holo GX"] },
        { p: 0.18, rarities: ["Rare Holo"] },
        { p: 0.08, rarities: ["Rare Ultra"] },
        { p: 0.03, rarities: ["Rare Rainbow"] },
      ],
    ],
  },
  // Team Up: 10 cards = 5 commons, 3 uncommons, 1 reverse holo, 1 rare slot (Rare / Holo / GX / Prism Star / full art / rainbow / gold). Plus 1 Basic Energy and a code card (not modelled).
  "sm9": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Common", "Uncommon", "Rare", "Rare Holo"] },
      ],
      [
        { p: 0.61111, rarities: ["Rare"] },
        { p: 0.166667, rarities: ["Rare Holo"] },
        { p: 0.1, rarities: ["Rare Holo GX"] },
        { p: 0.055556, rarities: ["Rare Prism Star"] },
        { p: 0.041667, rarities: ["Rare Ultra"] },
        { p: 0.016667, rarities: ["Rare Rainbow"] },
        { p: 0.008333, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 10 game cards + 1 Basic Energy (energy omitted: no energy images in the data) = 5 commons, 3 uncommons (secret rares 109-113 are on the uncommon sheet), 1 reverse holo (BREAK ~1 in 18), 1 rare slot (Rare, Rare Holo, Pokémon-EX ~1 in 8.2, full art ~1 in 15). (estimativa)
  "xy12": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.8765432098765432, rarities: ["Uncommon"] },
        { p: 0.1234567901234568, rarities: ["Rare Secret"] },
      ],
      [
        { p: 0.55, rarities: ["Common"] },
        { p: 0.25, rarities: ["Uncommon"] },
        { p: 0.08, rarities: ["Rare"] },
        { p: 0.0644444444444444, rarities: ["Rare Holo"] },
        { p: 0.05555555555555555, rarities: ["Rare BREAK"] },
      ],
      [
        { p: 0.6113821138211383, rarities: ["Rare"] },
        { p: 0.2, rarities: ["Rare Holo"] },
        { p: 0.12195121951219513, rarities: ["Rare Holo EX"] },
        { p: 0.06666666666666667, rarities: ["Rare Ultra"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 5 commons, 2 uncommons, 1 reverse holo, 1 rare slot (non-holo rare, holo, ex ~1 in 12, Gold Star ~1 in 72, secret rare ~1 in 108). No basic energy in the set.
  "ex7": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.3368421052631579, rarities: ["Common"] },
        { p: 0.3684210526315789, rarities: ["Uncommon"] },
        { p: 0.14736842105263157, rarities: ["Rare"] },
        { p: 0.14736842105263157, rarities: ["Rare Holo"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.22685185185185186, rarities: ["Rare Holo"] },
        { p: 0.08333333333333333, rarities: ["Rare Holo EX"] },
        { p: 0.013888888888888888, rarities: ["Rare Holo Star"] },
        { p: 0.009259259259259259, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 5 commons, 2 uncommons, 1 reverse holo, 1 rare slot (non-holo rare, holo ~2 in 9, ex ~1 in 12, secret rare ~1 in 36). No basic energy in the set.
  "ex6": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.34951456310679613, rarities: ["Common"] },
        { p: 0.34951456310679613, rarities: ["Uncommon"] },
        { p: 0.13592233009708737, rarities: ["Rare"] },
        { p: 0.1650485436893204, rarities: ["Rare Holo"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.2222222222222222, rarities: ["Rare Holo"] },
        { p: 0.08333333333333333, rarities: ["Rare Holo EX"] },
        { p: 0.027777777777777776, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 4 commons, 2 uncommons, 1 rare (always), 1 reverse holo (any card, basic energy included), 1 premium slot (ex ~1 in 6, holo rare ~1 in 6, basic energy ~1 in 3, otherwise a common).
  "ex1": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Rare"] },
      ],
      [
        { p: 0.39603960396039606, rarities: ["Common"] },
        { p: 0.33663366336633666, rarities: ["Uncommon"] },
        { p: 0.12871287128712872, rarities: ["Rare"] },
        { p: 0.13861386138613863, rarities: ["Rare Holo"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Common"] },
        { p: 0.16666666666666666, rarities: ["Rare Holo"] },
        { p: 0.16666666666666666, rarities: ["Rare Holo EX"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 5 commons, 2 uncommons, 1 reverse-holo slot (any main-set card), 1 rare slot (non-holo rare, H-numbered holo rare ~1 in 3.4 packs, or Crystal Pokémon secret rare 145-150 ~1 in 18). No basic energy in the set. (estimativa)
  "ecard3": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6, rarities: ["Common"] },
        { p: 0.3, rarities: ["Uncommon"] },
        { p: 0.1, rarities: ["Rare"] },
      ],
      [
        { p: 0.6503267973856208, rarities: ["Rare"] },
        { p: 0.29411764705882354, rarities: ["Rare Holo"] },
        { p: 0.05555555555555555, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 4 commons, 2 uncommons, 1 rare (always), 1 reverse holo, 1 premium slot (H-numbered holo ~11 in 36, Crystal Pokémon secret rare ~1 in 36, otherwise a common). No basic energy in the set. (estimativa)
  "ecard2": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Rare"] },
      ],
      [
        { p: 0.3469387755102041, rarities: ["Common"] },
        { p: 0.32653061224489793, rarities: ["Uncommon"] },
        { p: 0.32653061224489793, rarities: ["Rare"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Common"] },
        { p: 0.3055555555555556, rarities: ["Rare Holo"] },
        { p: 0.027777777777777776, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 9 cards = 4 commons, 2 uncommons, 1 rare (always), 1 reverse holo (any non-basic-energy card, equal odds per card), 1 premium slot (holo rare ~1 in 3, otherwise a common). A pack can hold holo + rare + reverse rare. (estimativa)
  "ecard1": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Rare"] },
      ],
      [
        { p: 0.3081761006289308, rarities: ["Common"] },
        { p: 0.2389937106918239, rarities: ["Uncommon"] },
        { p: 0.25157232704402516, rarities: ["Rare"] },
        { p: 0.20125786163522014, rarities: ["Rare Holo"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Common"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Real English pack: 11 cards = 6 commons, 3 uncommons, 1 reverse holo (any of the 110 cards, fireworks pattern), 1 rare (holo ~1 in 3, otherwise non-holo rare). No basic energy in the set.
  "base6": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.32727272727272727, rarities: ["Common"] },
        { p: 0.32727272727272727, rarities: ["Uncommon"] },
        { p: 0.17272727272727273, rarities: ["Rare"] },
        { p: 0.17272727272727273, rarities: ["Rare Holo"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Real English pack: 11 cards = 7 commons, 3 uncommons, 1 rare slot (non-holo rare, holo rare ~9 per 36-pack box, or Shining Pokémon ~3 per box). No reverse holos; Neo Destiny has no basic energy cards in the set.
  "neo4": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.25, rarities: ["Rare Holo"] },
        { p: 0.08333333333333333, rarities: ["Rare Shining"] },
      ],
    ],
  },
  // Real English pack: 11 cards = 7 commons, 3 uncommons, 1 rare slot (non-holo rare, holo ~1 in 4, or Shining Pokémon ~1 in 12). No basic energy in the set.
  "neo3": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.25, rarities: ["Rare Holo"] },
        { p: 0.08333333333333333, rarities: ["Rare Shining"] },
      ],
    ],
  },
  // Real English pack: 11 cards = 7 commons, 3 uncommons, 1 rare (holo ~1 in 3, otherwise non-holo rare). No basic energy in the set.
  "neo2": {
    slots: [
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Neo Genesis (unlimited): 11 game cards = 6 commons, 1 basic energy (printed in the set), 3 uncommons, 1 rare slot (Rare Holo ~1 in 3, else Rare).
  "neo1": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: [""] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Real English unlimited pack: 11 cards = 1 basic energy, 6 commons, 3 uncommons, 1 rare (holo ~1 in 3, otherwise non-holo rare).
  "gym2": {
    slots: [
      [
        { p: 1.0, rarities: [""] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Real English unlimited pack: 11 cards = 7 common-sheet cards (commons plus the set's basic energy cards), 3 uncommons, 1 rare (holo ~1 in 3 packs, otherwise non-holo).
  "gym1": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 0.5, rarities: ["Common"] },
        { p: 0.5, rarities: [""] },
      ],
      [
        { p: 0.5, rarities: ["Common"] },
        { p: 0.5, rarities: [""] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Team Rocket (unlimited): 11 game cards = 7 commons, 3 uncommons, 1 rare slot (Rare Holo ~1 in 3, else Rare); the secret Dark Raichu (83/82) very rarely takes the holo's place. No basic energy. (estimativa)
  "base5": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3233333333333333, rarities: ["Rare Holo"] },
        { p: 0.01, rarities: ["Rare Secret"] },
      ],
    ],
  },
  // Real English pack: 11 cards = 2 basic energies, 5 commons, 3 uncommons, 1 rare (holo ~1 in 3 packs, otherwise non-holo rare). No reverse holos.
  "base4": {
    slots: [
      [
        { p: 1.0, rarities: [""] },
      ],
      [
        { p: 1.0, rarities: [""] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Common"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 1.0, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Unlimited Fossil: 11 game cards = 7 commons, 3 uncommons, 1 rare slot (Rare Holo ~1 in 3, else Rare). No energy.
  "base3": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Unlimited Jungle: 11 game cards = 7 commons, 3 uncommons, 1 rare slot (Rare Holo ~1 in 3, else Rare). No energy in Jungle packs.
  "base2": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
  // Unlimited Base Set: 11 game cards = 5 commons, 2 basic energies (printed in the set), 3 uncommons, 1 rare slot (Rare Holo ~1 in 3, else non-holo Rare). Exactly one rare per pack.
  "base1": {
    slots: [
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: ["Common"] },
      ],
      [
        { p: 1, rarities: [""] },
      ],
      [
        { p: 1, rarities: [""] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 1, rarities: ["Uncommon"] },
      ],
      [
        { p: 0.6666666666666666, rarities: ["Rare"] },
        { p: 0.3333333333333333, rarities: ["Rare Holo"] },
      ],
    ],
  },
};
