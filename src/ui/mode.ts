import type { CreatureSpecies } from "../entities/creature";
import type { BuffType } from "../entities/buffs";

/** Editing modes — mutually exclusive */
export enum EditorMode {
  Select = "select",
  Place = "place",
  Move = "move",
  Delete = "delete",
}

/** What the player intends to place on the next arena click */
export type PendingPlacement =
  | { kind: "creature"; species: CreatureSpecies }
  | { kind: "food"; foodType: "fuel" | "health" }
  | { kind: "buff"; buffType: BuffType }
  | { kind: "spawner"; species: CreatureSpecies };
