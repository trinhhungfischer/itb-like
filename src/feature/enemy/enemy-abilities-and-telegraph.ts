import type { Board } from '../../core/board/index.js';
import type { Tile } from '../../core/board/board-types.js';
import type { BusEvent } from '../../core/events/event-bus.js';
import type { CombatResolver, EnemyDriver } from '../../core/turn/turn-phase-contracts.js';
import type { CombatStateView } from '../../core/combat/combat-state-interface.js';
import type { Unit } from '../heroes-abilities/unit.js';
import type { EffectPrimitive } from '../../core/combat/combat-types.js';

export interface EnemyUnitProvider {
  getAliveEnemies(): readonly Unit[];
  getAliveHeroes(): readonly Unit[];
}

export interface Intent {
  readonly abilityId: string;
  readonly targetId?: string;
  readonly telegraphedMoveDestination?: Tile | null;
  readonly telegraphedEffectTiles?: readonly Tile[];
  readonly effects: readonly EffectPrimitive[];
}

export class EnemyAbilitiesAndTelegraph implements EnemyDriver {
  private readonly intents = new Map<string, Intent>();
  private currentTurnEnvironmentTiles = new Set<Tile>();
  private currentTurnLethalThreatCount = 0;

  constructor(
    private readonly combatResolver: CombatResolver,
    private readonly state: CombatStateView,
    private readonly unitProvider: EnemyUnitProvider
  ) {}

  public chooseIntents(board: Board): void {
    const enemies = this.getSortedEnemies();
    const heroes = this.unitProvider.getAliveHeroes();
    
    // Clear previous fixed state
    this.currentTurnEnvironmentTiles.clear();
    this.currentTurnLethalThreatCount = 0;
    
    // Compute environment tiles (thin pass-through for v1: getHazard == 'Fire')
    for (let r = 0; r < board.height; r++) {
      for (let c = 0; c < board.width; c++) {
        if (board.getHazard(c, r) === 'Fire') {
          this.currentTurnEnvironmentTiles.add({ col: c, row: r });
        }
      }
    }

    for (const enemy of enemies) {
      if (heroes.length === 0) {
        this.intents.set(enemy.id, { abilityId: 'Idle', effects: [] });
        continue;
      }
      this.chooseIntentForEnemy(enemy, heroes, board);
    }

    // Compute lethal threat count (ADR-0011 / F6)
    for (const hero of heroes) {
      let threatCount = 0;
      
      // Check environment threats for this hero
      for (const t of this.currentTurnEnvironmentTiles) {
         if (t.col === hero.position.col && t.row === hero.position.row) {
            threatCount++;
         }
      }
      
      // Check enemy intents
      for (const enemy of enemies) {
         const intent = this.intents.get(enemy.id);
         if (intent && intent.effects) {
           for (const effect of intent.effects) {
             if (effect.kind === 'damage' && (effect as any).targetId === hero.id) {
               threatCount++;
             }
           }
         }
      }
      
      this.currentTurnLethalThreatCount += threatCount;
    }
  }

  private chooseIntentForEnemy(enemy: Unit, heroes: readonly Unit[], board: Board): void {
    const nearestHero = this.findNearestHero(enemy, heroes, board);
    const { abilityId, attackRange } = this.getEnemyAbilityParams(enemy);
    const moveRange = (enemy as any).moveRange !== undefined ? (enemy as any).moveRange : 3;

    if (!nearestHero) {
      this.intents.set(enemy.id, { abilityId: 'Idle', effects: [] });
      return;
    }

    const dist = board.distance(enemy.position, nearestHero.position);
    if (dist <= attackRange) {
      this.intents.set(enemy.id, {
        abilityId,
        targetId: nearestHero.id,
        telegraphedMoveDestination: null,
        telegraphedEffectTiles: [nearestHero.position],
        effects: [{ kind: 'damage', targetId: nearestHero.id, amount: 1 }]
      });
      return;
    }

    this.pathAndSetIntent(enemy, nearestHero, board, moveRange, attackRange, abilityId);
  }

  private findNearestHero(enemy: Unit, heroes: readonly Unit[], board: Board): Unit | null {
    let nearestHero: Unit | null = null;
    let minDistance = Infinity;

    for (const hero of heroes) {
      const dist = board.distance(enemy.position, hero.position);
      if (dist < minDistance) {
        minDistance = dist;
        nearestHero = hero;
      } else if (dist === minDistance) {
        if (hero.id.localeCompare(nearestHero!.id, 'en', { numeric: true }) < 0) {
          nearestHero = hero;
        }
      }
    }
    return nearestHero;
  }

  private getEnemyAbilityParams(enemy: Unit): { abilityId: string; attackRange: number } {
    const ability = enemy.abilities && enemy.abilities[0] ? (enemy.abilities[0] as any) : null;
    const attackRange = ability && ability.shape && typeof ability.shape.range === 'number' ? ability.shape.range : 1;
    const abilityId = ability ? ability.id : 'Attack';
    return { abilityId, attackRange };
  }

  private pathAndSetIntent(enemy: Unit, target: Unit, board: Board, moveRange: number, attackRange: number, abilityId: string): void {
    const reachable = board.reachableTiles(enemy.position, moveRange, board);
    
    const pathLengths = new Map<string, number>();
    for (let m = 1; m <= moveRange; m++) {
      const tilesM = board.reachableTiles(enemy.position, m, board);
      for (const t of tilesM) {
         const key = `${t.col},${t.row}`;
         if (!pathLengths.has(key)) {
            pathLengths.set(key, m);
         }
      }
    }

    let bestDest: Tile | null = null;
    let bestPathLength = Infinity;

    for (const t of reachable) {
       const distToTarget = board.distance(t, target.position);
       if (distToTarget <= attackRange) {
          const pathLength = pathLengths.get(`${t.col},${t.row}`)!;
          if (!bestDest) {
            bestDest = t;
            bestPathLength = pathLength;
          } else if (pathLength < bestPathLength) {
            bestDest = t;
            bestPathLength = pathLength;
          } else if (pathLength === bestPathLength) {
            if (t.row < bestDest.row) {
              bestDest = t;
            } else if (t.row === bestDest.row && t.col < bestDest.col) {
              bestDest = t;
            }
          }
       }
    }

    if (bestDest) {
      this.intents.set(enemy.id, {
        abilityId,
        targetId: target.id,
        telegraphedMoveDestination: bestDest,
        telegraphedEffectTiles: [target.position],
        effects: [{ kind: 'damage', targetId: target.id, amount: 1 }]
      });
    } else {
      this.intents.set(enemy.id, { abilityId: 'Idle', effects: [] });
    }
  }

  public getIntent(unitId: string): Intent | undefined {
    return this.intents.get(unitId);
  }

  public resolveTelegraphed(board: Board): readonly BusEvent[] {
    const enemies = this.getSortedEnemies();
    const allEvents: BusEvent[] = [];
    
    for (const enemy of enemies) {
      if (!this.state.hasUnit(enemy.id)) {
        continue;
      }
      const intent = this.intents.get(enemy.id);
      if (!intent || !intent.effects) {
        continue;
      }

      const effectsToResolve: EffectPrimitive[] = [];
      let enemyPos: Tile | null = null;
      for (let r = 0; r < board.height; r++) {
        for (let c = 0; c < board.width; c++) {
          if (board.getOccupant(c, r) === enemy.id) {
            enemyPos = { col: c, row: r };
            break;
          }
        }
        if (enemyPos) break;
      }

      if (intent.telegraphedMoveDestination && enemyPos) {
        const dest = intent.telegraphedMoveDestination;
        if (enemyPos.col !== dest.col || enemyPos.row !== dest.row) {
          effectsToResolve.push({ kind: 'removeUnit', targetId: enemy.id, cause: 'Recalled' });
          effectsToResolve.push({
            kind: 'spawnUnit',
            tile: dest,
            unitSpec: { id: enemy.id, hp: this.state.getHp(enemy.id), hazardImmunities: this.state.getHazardImmunities(enemy.id) }
          });
          enemyPos = dest;
        }
      }

      let whiff = false;
      if (intent.targetId && enemyPos) {
        const { attackRange } = this.getEnemyAbilityParams(enemy);
        let targetPos: Tile | null = null;
        for (let r = 0; r < board.height; r++) {
          for (let c = 0; c < board.width; c++) {
            if (board.getOccupant(c, r) === intent.targetId) {
              targetPos = { col: c, row: r };
              break;
            }
          }
          if (targetPos) break;
        }

        if (!targetPos) {
          whiff = false; // Target is gone, attack still fires at telegraphed tiles (no-op)
        } else {
          const dist = board.distance(enemyPos, targetPos);
          if (dist > attackRange) {
            whiff = true;
          } else {
             // simple ray check to ensure not blocked by a wall
             // calculate direction
             const dx = Math.sign(targetPos.col - enemyPos.col);
             const dy = Math.sign(targetPos.row - enemyPos.row);
             // if it's orthogonal, we can check rayTiles
             if ((dx === 0 || dy === 0) && dist > 1) {
                const dir = dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N';
                const tiles = board.rayTiles(enemyPos, dir as any, dist);
                if (tiles.length < dist) {
                   whiff = true;
                }
             }
          }
        }
      }

      if (whiff) {
        allEvents.push({ type: 'enemy_action_whiffed', unitId: enemy.id } as any);
      } else {
        if (intent.telegraphedEffectTiles && intent.telegraphedEffectTiles.length > 0) {
          for (const tile of intent.telegraphedEffectTiles) {
            const occupant = board.getOccupant(tile.col, tile.row);
            if (occupant) {
              for (const eff of intent.effects) {
                if (eff.kind === 'damage') {
                  effectsToResolve.push({ ...eff, targetId: occupant });
                } else if (eff.kind === 'push' || eff.kind === 'pull') {
                  effectsToResolve.push({ ...eff, targetId: occupant } as any);
                } else {
                  effectsToResolve.push(eff);
                }
              }
            }
          }
        } else if (intent.effects.length > 0) {
          effectsToResolve.push(...intent.effects);
        }
      }

      if (effectsToResolve.length > 0) {
        const events = this.combatResolver.resolve(board, effectsToResolve as any);
        allEvents.push(...events);
      }
    }
    
    return allEvents;
  }

  public emergeSpawns(_board: Board): readonly BusEvent[] {
    // Spawn emergence logic goes here.
    return [];
  }

  /**
   * Temporary test hook to inject intents, since target selection AI
   * (which normally populates this) is deferred to Story 002.
   */
  public setIntent(unitId: string, intent: Intent): void {
    this.intents.set(unitId, intent);
  }

  private getSortedEnemies(): readonly Unit[] {
    const enemies = [...this.unitProvider.getAliveEnemies()];
    // Ascending unitId order per TR-ENEMY-002
    return enemies.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  }

  public telegraphedEnvironmentTiles(turn: number): Set<Tile> {
    return new Set(this.currentTurnEnvironmentTiles);
  }

  public telegraphedLethalThreatCount(turn: number): number {
    return this.currentTurnLethalThreatCount;
  }
}
