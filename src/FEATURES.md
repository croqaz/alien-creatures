# Alien creatures simulator

This is a little game app, running in a browser. The logic is written in TypeScript + Vite.

The game happens in a browser tab, where there's a rectangle arena that the player can zoom in and out, and pan up/ down & left/ right.
There are 4 game speeds: 1x, 2x, 3x, 4x (keys 1, 2, 3, 4 respectively) and pause (space key toggle).

The player can spawn a few creatures:

- a peaceful green blob that walks around slowly and eats green fuel, or red hearts and runs away if predators are very close;
  The blob is a round shape & has maxSpeed:60, maxHealth:140, maxEnergy:120.
- a fast and very shy floater that runs away from any creature, including its own species. It's the fastest creature;
  The floater has maxSpeed:120, maxHealth:60, maxEnergy:80.
- a super curious crawler that tries to get close to any creature and look at it, including its own species. It has the most HP;
  The crawler has maxSpeed:40, maxHealth:180, maxEnergy:160.
- a mighty defender that is normally peaceful, but fill retaliate for a short time when an aggressive creature attacks it;
  The defender has a square shape & has maxSpeed:70, maxHealth:120, maxEnergy:160.
- a Lurker stealth predator that hunts creatures smaller than it (based on creature radius)
  The lurker is a triangle shape & has maxSpeed:100, maxHealth:100, maxEnergy:80.
- a Spiker aggressive hunter that hunts any other creature except its own species
  The spiker is a spiky shape & has maxSpeed:80, maxHealth:100, maxEnergy:100.

All these creatures have the same size on the map, but different shapes and colors.
In the future we'll have larger creature, but for now they are all the same size.
All creatures consume energy at 1 energy every 10 seconds (constant defined in core config),
unless they have energy=Infinity. When the energy reaches 0, creatures take 1 damage per second until they die,
or they find and eat fuel cells, or health hearts.

All peaceful creatures (blobs, floaters, crawlers and defenders) walk around randomly, but realistically.
All aggressive creatures (lurker and spiker) are constantly looking for prey to hunt.
Aggressive creatures only get half HP from health hearts, but they heal for 1 full heart when they kill another creature.

All creatures are peaceful to their own faction, and they tend to help each other when they are attacked,
but only if they have either damage>0 or retaliation>0.
(example: Defenders will help nearby Defenders when they are hunted by a Spiker)

When creatures are attacked, their highest priority is to either run or fight back (if they can retaliate),
their perception radius is greatly reduced during battle so if there is health nearby,
they will prioritize getting the health to save their life,
and if they have low energy, they will prioritize getting nearby fuel cells.
When not fighting and have low health, creatures prioritize finding health hearts.
When not fighting and have low energy, they prioritize finding fuel cells.
If they are looking for health and don't have full energy, creatures will pickup nearby fuel cells
and continue looking for health with high priority.
Helping other faction creatures is a lower priority, if a creature needs fuel or health, that's more important.

The creature behaviours are modular and flexible and we will have more behaviours and creatures in the future.
We will definitely have bosses and boss minions and factions for them in the future, don't implement this yet.

Other than creatures, a player can also spawn:

- green fuel cells that replenish creature energy
- red health hearts that heal creature health

In the future we will have objects that decay over time, so prepare the code for that.

There are a few buffs that can be placed on the map:

- an invulnerability shield buff that makes a creature invulnerable to damage and also doesn't consume energy for 10 seconds
- a speed buff that makes a creature 2x faster for 10 seconds
- a dagger buff that makes creatures with either damage or retaliation have 2x either damage or retaliation
  (doesn't affect blobs, floaters and crawlers)

The fuel, heart objects and buffs should all have the same size on the map.
We will have more types of objects and buffs in the future, so make it flexible and don't hardcode them.

A player can also place Spawner towers, that spawn one type of creature.
There is one specific spawner for every type of creature.
Creatures are loyal to their spawner type and they never attack it.
A spawner tower cannot move on the map and has Infinity energy, but has 5000 HP
and can be damaged and destroyed by attackers.
Spawner towers spawn their respective creature once every X seconds
(there's a slider in the UI that increases spawning speed from: 1 every 5 sec up to 5 per sec)

The UI is HTML and the game arena takes the whole screen but there's a UI and the user can
click to spawn 1 or more of any creature, or object (like fuel or heart), or spawner.

The player can select one creature and see its stats like HP, energy and what it's currently doing
(Wandering, Looking for energy, Running from Spiker, Hunting a Blob, etc)

When clicking a spawn button, the creature will be spawned inside the visible screen randomly,
but there is an exact placing button that allows a player to place a creature on the map.
There is also a mode that moves a creature, so a player can drag & drop the creature.
There is also a mode that deletes a creature.
These 4 modes to select, place, move and delete are exclusive to each other.

There are some TypeScript code files already defined in folder `src/`, please follow that structure.

You have some documentation available for TypeScript and Vite that you can search like:

- dedoc search vite index -- search "index" in Vite docs
- dedoc search vite config -- search "config" in Vite docs
- dedoc search typescript interface -- search for "interface" in TypeScript docs
