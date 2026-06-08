import { Fireball } from "./fireball";

/** Flat damage every arrow deals on hit, regardless of who loosed it. */
export const ARROW_DAMAGE = 25;
/** Arrow flight speed — matches a fireball's. */
export const ARROW_SPEED = 340;
/** Seconds of sim time an Archer waits between shots. */
export const ARCHER_COOLDOWN = 1.5;

/**
 * A slim projectile loosed by an Archer creature. Mechanically a lean Fireball —
 * identical straight flight, single-target hit, ally immunity, and fizzle on
 * walls/range — but it carries a flat {@link ARROW_DAMAGE} and the renderer
 * draws it as a feathered shaft instead of an ember. Being a Fireball subclass,
 * creatures dodge it with the same instinct they dodge fireballs.
 */
export class Arrow extends Fireball {
  radius = 6;
}
