import { Vector2 } from './utils';
import { BuildingType, BUILDINGS, TILE_SIZE } from './constants';

export abstract class Entity {
  id: string = Math.random().toString(36).substr(2, 9);
  pos: Vector2;
  radius: number = 20;
  hp: number = 100;
  maxHp: number = 100;
  isDead: boolean = false;
  lastHitTime: number = 0;
  path: Vector2[] | null = null;
  pathIndex: number = 0;

  constructor(x: number, y: number) {
    this.pos = new Vector2(x, y);
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.lastHitTime = performance.now();
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
    return amount;
  }
}

export type AIStrategy = 'Balanced' | 'Greedy' | 'Fortress' | 'Swarm' | 'Elite' | 'Archer' | 'Frost' | 'Fire' | 'Tall' | 'Wide';

export class Warden extends Entity {
  wood: number = 50; // Starting wood: 50
  gold: number = 0;
  claimedBaseId: string | null = null;
  speed: number = 4.5;
  targetPos: Vector2 | null = null;
  baseDecisionTimer: number = 0;
  stuckTime: number = 0;
  isLumbering: boolean = false;
  forbiddenKnowledge: number = 0;
  fkMilestonesReached: Set<number> = new Set();
  strategy: AIStrategy = 'Balanced';
  upgrades: { offense: number, agility: number, defense: number, economy: number } = { offense: 0, agility: 0, defense: 0, economy: 0 };
  aiTargets: { towers: number, walls: number, lumber: number, mines: number } = { towers: 8, walls: 4, lumber: 6, mines: 4 };
  unlockedBuildings: Set<BuildingType> = new Set([
    BuildingType.WOOD_WALL, 
    BuildingType.GUARD_TOWER, 
    BuildingType.LUMBER_MILL, 
    BuildingType.GOLD_MINE,
    BuildingType.REPAIR_HUT
  ]);

  constructor(x: number, y: number, public isAI: boolean = false) {
    super(x, y);
    this.radius = 18;
    this.hp = 100;
    this.maxHp = 100;
  }
}

export class Building extends Entity {
  lastActionTime: number = 0;
  gridX: number;
  gridY: number;
  tilt: number = 0;
  tiltSpeed: number = Math.random() * 0.02 + 0.01;
  upgrades: Record<string, number> = {};
  accumulatedWood: number = 0;
  accumulatedGold: number = 0;
  textTimer: number = 0;

  constructor(gx: number, gy: number, public type: BuildingType, public owner: Warden | null = null, overrideMaxHp?: number) {
    super(gx * TILE_SIZE + TILE_SIZE / 2, gy * TILE_SIZE + TILE_SIZE / 2);
    const stats = BUILDINGS[type];
    this.upgrades = { defense: 0, offense: 0, economy: 0 };
    this.maxHp = overrideMaxHp || stats.maxHp;
    this.hp = this.maxHp;
    this.gridX = gx;
    this.gridY = gy;
  }

  evolve(newType: BuildingType, newScaleFactor?: number) {
    const newStats = BUILDINGS[newType];
    const hpRatio = this.hp / this.maxHp;
    
    // Update scale factor if provided, otherwise keep existing
    if (newScaleFactor !== undefined) {
      (this as any).scaleFactor = newScaleFactor;
    }
    const scaleFactor = (this as any).scaleFactor || 1;
    
    this.type = newType;
    this.maxHp = Math.floor(newStats.maxHp * scaleFactor);
    this.hp = this.maxHp * hpRatio;
  }

  getDynamicName(): string {
    return BUILDINGS[this.type].label;
  }
}

export class Demon extends Entity {
  level: number = 1;
  speed: number = 5.5; 
  damage: number = 6; // Increased starting damage
  attackSpeed: number = 4.0;
  lastAttackTime: number = 0;
  lastRegenTime: number = 0;
  xp: number = 0;
  nextLevelXp: number = 300; // Lower starting XP for faster early levels
  attackRange: number = 90;
  attackCooldown: number = 1000;
  state: 'HUNT' | 'RETREAT' | 'REGEN' = 'HUNT';
  currentTarget: Entity | null = null;
  targetLockedTime: number = 0;
  lastTargetId: string | null = null;
  lastTargetBaseId: string | null = null;
  killCount: number = 0;
  corruptionTrail: Vector2[] = [];
  lastStuckPos: Vector2 = new Vector2(0, 0);
  stuckDuration: number = 0;
  pathTimer: number = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.radius = 24; // Bigger
    this.hp = 600; 
    this.maxHp = 600;
  }
}

export class LesserDemon extends Entity {
  speed: number = 3.5;
  damage: number = 8;
  attackSpeed: number = 1.2;
  lastAttackTime: number = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.radius = 8;
    this.hp = 120;
    this.maxHp = 120;
  }
}

export class Projectile {
  pos: Vector2;
  velocity: Vector2;
  distanceTraveled: number = 0;
  maxRange: number = 300;
  speed: number = 10;
  isBomb: boolean = false;
  color: string = '#fbbf24';
  size: number = 6;
  
  constructor(x: number, y: number, public target: Entity, public damage: number, isBomb: boolean = false, color: string = '#fbbf24', speed: number = 10, size: number = 6, range: number = 300) {
    this.pos = new Vector2(x, y);
    this.isBomb = isBomb;
    this.color = color;
    this.speed = speed;
    this.size = size;
    this.maxRange = range;
    
    // Initial velocity towards target (non-homing)
    const dir = new Vector2(target.pos.x - x, target.pos.y - y).normalize();
    this.velocity = dir;
  }

  update(dt: number) {
    const step = this.speed * (dt * 60);
    this.pos.x += this.velocity.x * step;
    this.pos.y += this.velocity.y * step;
    this.distanceTraveled += step;
    
    // Check if we hit the target area (check distance to target pos considering radius)
    const distTarget = this.pos.distanceTo(this.target.pos);
    if (distTarget < (this.target.radius + this.size)) return 'hit';
    
    if (this.distanceTraveled >= this.maxRange) return 'faded';
    
    return 'moving';
  }
}
