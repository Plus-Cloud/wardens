/**
 * Game Constants and Types
 */

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
}

export enum TileType {
  GRASS = 0,
  TREE = 1,
  CLEARING = 2,
  WALL = 3,
  STONE = 4,
}

export enum BuildingType {
  WOOD_WALL = 'WOOD_WALL',
  WOOD_WALL_HARDENED = 'WOOD_WALL_HARDENED',
  STONE_WALL = 'STONE_WALL',
  STONE_WALL_REINFORCED = 'STONE_WALL_REINFORCED',
  IRON_WALL = 'IRON_WALL',
  STEEL_BASTION = 'STEEL_BASTION',
  TITANIUM_WALL = 'TITANIUM_WALL',
  OBSIDIAN_BARRIER = 'OBSIDIAN_BARRIER',
  MYTHIC_BARRIER = 'MYTHIC_BARRIER',
  
  GUARD_TOWER = 'GUARD_TOWER',
  
  // Archer Branch
  ARCHER_TOWER = 'ARCHER_TOWER',
  RAPID_ARCHER = 'RAPID_ARCHER',
  LONGBOW_TOWER = 'LONGBOW_TOWER',
  SNIPER_TOWER = 'SNIPER_TOWER',
  
  // Bomb Branch
  BOMB_TOWER = 'BOMB_TOWER',
  HEAVY_BOMB = 'HEAVY_BOMB',
  CLUSTER_BOMB = 'CLUSTER_BOMB',
  NAPALM_TOWER = 'NAPALM_TOWER',
  
  // Frost Branch
  FROST_TOWER = 'FROST_TOWER',
  ICE_SPIRE = 'ICE_SPIRE',
  FREEZE_CANNON = 'FREEZE_CANNON',
  BLIZZARD_TOWER = 'BLIZZARD_TOWER',
  
  // Fire Branch
  FIRE_TOWER = 'FIRE_TOWER',
  BLAZE_TOWER = 'BLAZE_TOWER',
  INFERNO_SPIRE = 'INFERNO_SPIRE',
  PHOENIX_TOWER = 'PHOENIX_TOWER',

  GOLD_MINE = 'GOLD_MINE',
  ENCHANTED_MINE = 'ENCHANTED_MINE',
  DIVINE_MINE = 'DIVINE_MINE',
  FORBIDDEN_EXCAVATION = 'FORBIDDEN_EXCAVATION',
  ETERNAL_TREASURY = 'ETERNAL_TREASURY',

  REPAIR_HUT = 'REPAIR_HUT',
  
  LUMBER_SHACK = 'LUMBER_SHACK',
  LUMBER_MILL = 'LUMBER_MILL',
  LESSER_LOGGING_CAMP = 'LESSER_LOGGING_CAMP',
  LUMBER_YARD = 'LUMBER_YARD',
  LUMBER_FACTORY = 'LUMBER_FACTORY',
  LUMBER_CORPORATION = 'LUMBER_CORPORATION',
  LUMBER_EMPIRE = 'LUMBER_EMPIRE',
  
  // Forbidden Knowledge Towers
  SOULGUARD_TOWER = 'SOULGUARD_TOWER',
  SIEGE_CANNON = 'SIEGE_CANNON',
  SUPPLY_NODE = 'SUPPLY_NODE',
  VOID_COLLECTOR = 'VOID_COLLECTOR',
  ESSENCE_DISTILLER = 'ESSENCE_DISTILLER',
  ABYSSAL_SPIRE = 'ABYSSAL_SPIRE',
  SACRED_ALTAR = 'SACRED_ALTAR',
}

export interface BuildingStats {
  label: string;
  hp: number;
  maxHp: number;
  costWood: number;
  costGold: number;
  fkCost?: number; // Forbidden Knowledge cost
  range?: number;
  damage?: number;
  cooldown?: number;
  projectileSpeed?: number;
  projectileColor?: string;
  projectileSize?: number;
  color: string;
  shape: 'rectangle' | 'hexagon' | 'tower' | 'diamond' | 'trapezoid' | 'octagon' | 'star';
  glow?: string;
  upgradesTo?: BuildingType[]; // Changed to array for branching
  description?: string;
  icon?: string;
}

export const BUILDINGS: Record<BuildingType, BuildingStats> = {
  // --- WALLS ---
  [BuildingType.WOOD_WALL]: { 
    label: 'Wood Wall', hp: 150, maxHp: 150, costWood: 5, costGold: 0, 
    color: '#8B4513', shape: 'rectangle', upgradesTo: [BuildingType.WOOD_WALL_HARDENED],
    description: 'Basic wooden defense. Cheap and fast to build.', icon: '🪵'
  },
  [BuildingType.WOOD_WALL_HARDENED]: { 
    label: 'Hardened Wall', hp: 300, maxHp: 300, costWood: 15, costGold: 0, 
    color: '#6F370E', shape: 'rectangle', upgradesTo: [BuildingType.STONE_WALL],
    description: 'Treated wood with extra bracing.', icon: '🩹'
  },
  [BuildingType.STONE_WALL]: { 
    label: 'Stone Wall', hp: 800, maxHp: 800, costWood: 40, costGold: 4, 
    color: '#707070', shape: 'rectangle', upgradesTo: [BuildingType.STONE_WALL_REINFORCED],
    description: 'Solid masonry. Can withstand significant punishment.', icon: '🪨'
  },
  [BuildingType.STONE_WALL_REINFORCED]: { 
    label: 'Reinforced Stone', hp: 1800, maxHp: 1800, costWood: 80, costGold: 12, 
    color: '#505050', shape: 'rectangle', upgradesTo: [BuildingType.IRON_WALL],
    description: 'Iron-banded stone blocks.', icon: '🧱'
  },
  [BuildingType.IRON_WALL]: { 
    label: 'Iron Wall', hp: 4000, maxHp: 4000, costWood: 150, costGold: 35, 
    color: '#2F4F4F', shape: 'rectangle', upgradesTo: [BuildingType.STEEL_BASTION],
    description: 'Industrial grade iron plates.', icon: '⛓️'
  },
  [BuildingType.STEEL_BASTION]: { 
    label: 'Steel Bastion', hp: 8500, maxHp: 8500, costWood: 300, costGold: 80, 
    color: '#334155', shape: 'rectangle', upgradesTo: [BuildingType.TITANIUM_WALL],
    description: 'High-tensile steel defense.', icon: '🛡️'
  },
  [BuildingType.TITANIUM_WALL]: { 
    label: 'Titanium Wall', hp: 16000, maxHp: 16000, costWood: 600, costGold: 180, 
    color: '#94a3b8', shape: 'rectangle', upgradesTo: [BuildingType.OBSIDIAN_BARRIER],
    description: 'Lightweight but incredibly tough alloy. Highly durable.', icon: '🛸'
  },
  [BuildingType.OBSIDIAN_BARRIER]: { 
    label: 'Obsidian Barrier', hp: 35000, maxHp: 35000, costWood: 1200, costGold: 450, 
    color: '#0f172a', shape: 'rectangle', upgradesTo: [BuildingType.MYTHIC_BARRIER],
    description: 'Volcanic glass infused with base magic.', icon: '🌑'
  },
  [BuildingType.MYTHIC_BARRIER]: { 
    label: 'Mythic Barrier', hp: 85000, maxHp: 85000, costWood: 3000, costGold: 1200, 
    color: '#4f46e5', shape: 'rectangle', glow: '#6366f1',
    description: 'The ultimate arcane defense. Near indestructible power.', icon: '✨'
  },
  
  // --- TOWERS ---
  [BuildingType.GUARD_TOWER]: { 
    label: 'Guard Tower', hp: 400, maxHp: 400, costWood: 20, costGold: 0, 
    range: 7.5, damage: 18, cooldown: 850,
    projectileSpeed: 10, projectileColor: '#fbbf24', projectileSize: 4,
    color: '#A9A9A9', shape: 'octagon', upgradesTo: [
      BuildingType.ARCHER_TOWER, 
      BuildingType.BOMB_TOWER, 
      BuildingType.FROST_TOWER, 
      BuildingType.FIRE_TOWER
    ],
    description: 'Versatile defensive structure. Can be specialized.', icon: '🏰'
  },

  // Archer Branch
  [BuildingType.ARCHER_TOWER]: { 
    label: 'Archer Tower', hp: 600, maxHp: 600, costWood: 60, costGold: 10, 
    range: 8.5, damage: 24, cooldown: 650, 
    projectileSpeed: 12, projectileColor: '#fcd34d', projectileSize: 4,
    color: '#CD853F', shape: 'tower', upgradesTo: [BuildingType.RAPID_ARCHER, BuildingType.SNIPER_TOWER],
    description: 'Standard range defense with reliable fire rate.', icon: '🏹'
  },
  [BuildingType.RAPID_ARCHER]: { 
    label: 'Rapid Archer', hp: 800, maxHp: 800, costWood: 120, costGold: 30, 
    range: 9, damage: 28, cooldown: 350, 
    projectileSpeed: 15, projectileColor: '#fbbf24', projectileSize: 3,
    color: '#f59e0b', shape: 'tower', glow: '#fbbf24', upgradesTo: [BuildingType.LONGBOW_TOWER],
    description: 'Fires projectiles at an extreme speed. High DPS.', icon: '⚡'
  },
  [BuildingType.LONGBOW_TOWER]: { 
    label: 'Longbow Tower', hp: 1200, maxHp: 1200, costWood: 250, costGold: 80, 
    range: 15, damage: 120, cooldown: 1200, 
    projectileSpeed: 18, projectileColor: '#f59e0b', projectileSize: 5,
    color: '#d97706', shape: 'diamond', glow: '#f59e0b',
    description: 'Extreme range and high single-target damage.', icon: '🎯'
  },
  [BuildingType.SNIPER_TOWER]: { 
    label: 'Sniper Tower', hp: 1000, maxHp: 1000, costWood: 280, costGold: 120, 
    range: 18, damage: 450, cooldown: 3500, 
    projectileSpeed: 25, projectileColor: '#94a3b8', projectileSize: 3,
    color: '#475569', shape: 'tower', glow: '#94a3b8',
    description: 'Devastating shots from incredible distances.', icon: '🔭'
  },

  // Bomb Branch
  [BuildingType.BOMB_TOWER]: { 
    label: 'Bomb Tower', hp: 700, maxHp: 700, costWood: 140, costGold: 35, 
    range: 6.5, damage: 120, cooldown: 2500, 
    projectileSpeed: 7, projectileColor: '#4b5563', projectileSize: 10,
    color: '#4B4B4B', shape: 'trapezoid', upgradesTo: [BuildingType.HEAVY_BOMB, BuildingType.CLUSTER_BOMB],
    description: 'Deals splash damage to grouped enemies.', icon: '💣'
  },
  [BuildingType.HEAVY_BOMB]: { 
    label: 'Heavy Bombard', hp: 1200, maxHp: 1200, costWood: 300, costGold: 100, 
    range: 7.5, damage: 450, cooldown: 3500, 
    projectileSpeed: 6, projectileColor: '#1e293b', projectileSize: 14,
    color: '#1e293b', shape: 'octagon', glow: '#ef4444', upgradesTo: [BuildingType.NAPALM_TOWER],
    description: 'Massive shells that crush the toughest foes.', icon: '🧨'
  },
  [BuildingType.CLUSTER_BOMB]: { 
    label: 'Cluster Bomb', hp: 1100, maxHp: 1100, costWood: 280, costGold: 90, 
    range: 8, damage: 180, cooldown: 2800, 
    projectileSpeed: 8, projectileColor: '#f97316', projectileSize: 8,
    color: '#334155', shape: 'star', glow: '#f97316',
    description: 'Explodes into smaller child-bombs on impact.', icon: '💥'
  },
  [BuildingType.NAPALM_TOWER]: { 
    label: 'Napalm Tower', hp: 1500, maxHp: 1500, costWood: 500, costGold: 250, 
    range: 7.5, damage: 320, cooldown: 4000, 
    projectileSpeed: 7, projectileColor: '#ea580c', projectileSize: 12,
    color: '#7c2d12', shape: 'hexagon', glow: '#ea580c',
    description: 'Ignites the ground, dealing sustained burn damage.', icon: '🔥'
  },

  // Frost Branch
  [BuildingType.FROST_TOWER]: { 
    label: 'Frost Spire', hp: 600, maxHp: 600, costWood: 100, costGold: 25, 
    range: 8.5, damage: 15, cooldown: 1800, 
    projectileSpeed: 10, projectileColor: '#38bdf8', projectileSize: 6,
    color: '#38bdf8', shape: 'octagon', upgradesTo: [BuildingType.ICE_SPIRE],
    description: 'Slows enemies caught in its chilling aura.', icon: '❄️'
  },
  [BuildingType.ICE_SPIRE]: { 
    label: 'Ice Spire', hp: 1000, maxHp: 1000, costWood: 250, costGold: 60, 
    range: 10, damage: 45, cooldown: 1600, 
    projectileSpeed: 11, projectileColor: '#0ea5e9', projectileSize: 7,
    color: '#0ea5e9', shape: 'tower', upgradesTo: [BuildingType.FREEZE_CANNON],
    description: 'Crystallizes foes, significantly reducing movement.', icon: '🧊'
  },
  [BuildingType.FREEZE_CANNON]: { 
    label: 'Freeze Cannon', hp: 1400, maxHp: 1400, costWood: 450, costGold: 150, 
    range: 11, damage: 85, cooldown: 2000, 
    projectileSpeed: 13, projectileColor: '#0284c7', projectileSize: 9,
    color: '#0284c7', shape: 'octagon', upgradesTo: [BuildingType.BLIZZARD_TOWER],
    description: 'Fires concentrated beams of absolute zero. Freezes targets.', icon: '☃️'
  },
  [BuildingType.BLIZZARD_TOWER]: { 
    label: 'Blizzard Tower', hp: 2000, maxHp: 2000, costWood: 800, costGold: 400, 
    range: 13, damage: 150, cooldown: 2500, 
    projectileSpeed: 15, projectileColor: '#bae6fd', projectileSize: 10,
    color: '#bae6fd', shape: 'star', glow: '#38bdf8',
    description: 'Summons a localized storm to freeze all intruders.', icon: '🌪️'
  },

  // Fire Branch
  [BuildingType.FIRE_TOWER]: { 
    label: 'Fire Altar', hp: 650, maxHp: 650, costWood: 120, costGold: 30, 
    range: 6.5, damage: 75, cooldown: 1000, 
    projectileSpeed: 11, projectileColor: '#ef4444', projectileSize: 7,
    color: '#ef4444', shape: 'star', upgradesTo: [BuildingType.BLAZE_TOWER],
    description: 'Immolates enemies with intense heat.', icon: '🔥'
  },
  [BuildingType.BLAZE_TOWER]: { 
    label: 'Blaze Tower', hp: 1100, maxHp: 1100, costWood: 260, costGold: 80, 
    range: 7.5, damage: 140, cooldown: 900, 
    projectileSpeed: 13, projectileColor: '#dc2626', projectileSize: 8,
    color: '#dc2626', shape: 'star', upgradesTo: [BuildingType.INFERNO_SPIRE],
    description: 'Fires bolts of pure magma. High damage.', icon: '☄️'
  },
  [BuildingType.INFERNO_SPIRE]: { 
    label: 'Inferno Spire', hp: 1600, maxHp: 1600, costWood: 500, costGold: 220, 
    range: 8.5, damage: 320, cooldown: 800, 
    projectileSpeed: 15, projectileColor: '#991b1b', projectileSize: 10,
    color: '#991b1b', shape: 'tower', glow: '#ef4444', upgradesTo: [BuildingType.PHOENIX_TOWER],
    description: 'A towering pillar of eternal flame.', icon: '🌋'
  },
  [BuildingType.PHOENIX_TOWER]: { 
    label: 'Phoenix Tower', hp: 3000, maxHp: 3000, costWood: 1000, costGold: 500, 
    range: 10, damage: 850, cooldown: 1200, 
    projectileSpeed: 18, projectileColor: '#f87171', projectileSize: 12,
    color: '#f87171', shape: 'star', glow: '#facc15',
    description: 'Unleashes the wrath of the reborn sun. Massive AOE.', icon: '☀️'
  },

  // --- ECONOMY & UTILITY ---
  [BuildingType.GOLD_MINE]: { 
    label: 'Gold Mine', hp: 500, maxHp: 500, costWood: 80, costGold: 0, 
    color: '#FFD700', shape: 'trapezoid', upgradesTo: [BuildingType.ENCHANTED_MINE],
    description: 'Generates +2 gold/sec.', icon: '💰'
  },
  [BuildingType.ENCHANTED_MINE]: { 
    label: 'Enchanted Mine', hp: 1200, maxHp: 1200, costWood: 400, costGold: 50, 
    color: '#FFA500', shape: 'trapezoid', glow: '#fbbf24', upgradesTo: [BuildingType.DIVINE_MINE],
    description: 'Generates +8 gold/sec.', icon: '💎'
  },
  [BuildingType.DIVINE_MINE]: { 
    label: 'Divine Mine', hp: 2500, maxHp: 2500, costWood: 1200, costGold: 250, 
    color: '#F472B6', shape: 'trapezoid', glow: '#ec4899', upgradesTo: [BuildingType.FORBIDDEN_EXCAVATION],
    description: 'Generates +24 gold/sec.', icon: '👑'
  },
  [BuildingType.FORBIDDEN_EXCAVATION]: { 
    label: 'Void Extract', hp: 6000, maxHp: 6000, costWood: 4000, costGold: 1200, 
    color: '#8B5CF6', shape: 'trapezoid', glow: '#a78bfa', upgradesTo: [BuildingType.ETERNAL_TREASURY],
    description: 'Generates +60 gold/sec.', icon: '🌌'
  },
  [BuildingType.ETERNAL_TREASURY]: { 
    label: 'Eternal Bank', hp: 15000, maxHp: 15000, costWood: 12000, costGold: 5000, 
    color: '#3B82F6', shape: 'trapezoid', glow: '#60a5fa',
    description: 'Generates +200 gold/sec.', icon: '🏦'
  },

  [BuildingType.REPAIR_HUT]: { 
    label: 'Repair Hut', hp: 300, maxHp: 300, costWood: 80, costGold: 10, 
    range: 5, cooldown: 1200, 
    color: '#32CD32', shape: 'hexagon', 
    description: 'Automated repair station for nearby structures.', icon: '⚙️'
  },
  [BuildingType.LUMBER_SHACK]: {
    label: 'Wood Shack', hp: 800, maxHp: 800, costWood: 0, costGold: 0,
    color: '#A0522D', shape: 'rectangle', upgradesTo: [BuildingType.LUMBER_MILL],
    description: 'Generates +1.5 wood/sec.', icon: '🛖'
  },
  [BuildingType.LUMBER_MILL]: {
    label: 'Lumber Mill', hp: 2000, maxHp: 2000, costWood: 40, costGold: 0,
    color: '#D2691E', shape: 'rectangle', upgradesTo: [BuildingType.LESSER_LOGGING_CAMP, BuildingType.LUMBER_YARD],
    description: 'Generates +4.0 wood/sec.', icon: '🏭'
  },
  [BuildingType.LESSER_LOGGING_CAMP]: {
    label: 'Logging Camp', hp: 3500, maxHp: 3500, costWood: 120, costGold: 25,
    color: '#78350f', shape: 'rectangle', upgradesTo: [BuildingType.LUMBER_YARD],
    description: 'A fortified lumber post. +8.0 wood/sec.', icon: '🪵'
  },
  [BuildingType.LUMBER_YARD]: {
    label: 'Lumber Yard', hp: 5000, maxHp: 5000, costWood: 150, costGold: 10,
    color: '#8B4513', shape: 'rectangle', upgradesTo: [BuildingType.LUMBER_FACTORY],
    description: 'Generates +10.0 wood/sec.', icon: '🏗️'
  },
  [BuildingType.LUMBER_FACTORY]: {
    label: 'Lumber Factory', hp: 12000, maxHp: 12000, costWood: 600, costGold: 80,
    color: '#451a03', shape: 'rectangle', glow: '#f97316', upgradesTo: [BuildingType.LUMBER_CORPORATION],
    description: 'Generates +25 wood/sec.', icon: '🏬'
  },
  [BuildingType.LUMBER_CORPORATION]: {
    label: 'Wood Corp', hp: 30000, maxHp: 30000, costWood: 3500, costGold: 1200,
    color: '#1e293b', shape: 'rectangle', glow: '#fbbf24', upgradesTo: [BuildingType.LUMBER_EMPIRE],
    description: 'Generates +60 wood/sec.', icon: '🏢'
  },
  [BuildingType.LUMBER_EMPIRE]: {
    label: 'Lumber Empire', hp: 80000, maxHp: 80000, costWood: 12000, costGold: 5000,
    color: '#0f172a', shape: 'star', glow: '#ef4444',
    description: 'Generates +180 wood/sec. Massive resource engine.', icon: '🌌'
  },
  
  // --- FORBIDDEN KNOWLEDGE TOWERS ---
  [BuildingType.SOULGUARD_TOWER]: {
    label: 'Soulguard Spire', hp: 30000, maxHp: 30000, costWood: 1500, costGold: 600, fkCost: 2,
    color: '#10b981', shape: 'tower', glow: '#34d399',
    description: 'Elite defense. Absorbs 50% damage for nearby buildings. Requires 2 FK.', icon: '🛡️'
  },
  [BuildingType.SIEGE_CANNON]: {
    label: 'Siege Cannon', hp: 10000, maxHp: 10000, costWood: 3000, costGold: 1200, fkCost: 3,
    range: 25, damage: 1500, cooldown: 6000,
    projectileSpeed: 30, projectileColor: '#f43f5e', projectileSize: 6,
    color: '#334155', shape: 'octagon', glow: '#f43f5e',
    description: 'Slow firing, but destroys almost anything. Requires 3 FK.', icon: '🔭'
  },
  [BuildingType.SUPPLY_NODE]: {
    label: 'Supply Node', hp: 6000, maxHp: 6000, costWood: 1000, costGold: 500, fkCost: 1,
    color: '#f59e0b', shape: 'diamond', glow: '#fbbf24',
    description: 'Enhances worker efficiency across your base. Requires 1 FK.', icon: '⚡'
  },
  [BuildingType.VOID_COLLECTOR]: {
    label: 'Void Collector', hp: 8000, maxHp: 8000, costWood: 2000, costGold: 800, fkCost: 1,
    color: '#4c1d95', shape: 'octagon', glow: '#8b5cf6',
    description: 'Taps into the void to extract massive amounts of wood (+40/sec). Requires 1 FK.', icon: '🌪️'
  },
  [BuildingType.ESSENCE_DISTILLER]: {
    label: 'Essence Distiller', hp: 12000, maxHp: 12000, costWood: 5000, costGold: 2000, fkCost: 2,
    color: '#1e1b4b', shape: 'diamond', glow: '#6366f1',
    description: 'Refines raw essence into wood (+25/sec) and gold (+5/sec). Requires 2 FK.', icon: '🧪'
  },
  [BuildingType.ABYSSAL_SPIRE]: {
    label: 'Abyssal Spire', hp: 15000, maxHp: 15000, costWood: 3500, costGold: 1500, fkCost: 2,
    range: 16, damage: 1200, cooldown: 1800,
    projectileSpeed: 20, projectileColor: '#ec4899', projectileSize: 8,
    color: '#020617', shape: 'tower', glow: '#ec4899',
    description: 'Fires bolts of pure entropy. Massive single-target damage. Requires 2 FK.', icon: '👁️'
  },
  [BuildingType.SACRED_ALTAR]: {
    label: 'Sacred Altar', hp: 5000, maxHp: 5000, costWood: 0, costGold: 0,
    color: '#8b5cf6', shape: 'octagon', glow: '#c084fc',
    description: 'The heart of your domain. Generates +1.0 wood/sec. If destroyed, you perish.', icon: '🏛️'
  },
};

export const GRID_SIZE = 64;
export const TILE_SIZE = 64;
export const MAP_SIZE = GRID_SIZE * TILE_SIZE;

export interface BaseLayout {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  entranceX: number;
  entranceY: number;
  tiles: { x: number, y: number }[];
}

export const BASES: BaseLayout[] = [
  {
    id: 'base1',
    name: 'North West Sanctuary',
    centerX: 20, centerY: 20,
    entranceX: 20, entranceY: 24,
    tiles: [] // Will be populated in engine for more flexibility
  },
  {
    id: 'base2',
    name: 'North East Sanctuary',
    centerX: 44, centerY: 20,
    entranceX: 44, entranceY: 24,
    tiles: []
  },
  {
    id: 'base3',
    name: 'South West Sanctuary',
    centerX: 20, centerY: 44,
    entranceX: 20, entranceY: 40,
    tiles: []
  },
  {
    id: 'base4',
    name: 'South East Sanctuary',
    centerX: 44, centerY: 44,
    entranceX: 44, entranceY: 40,
    tiles: []
  }
];
