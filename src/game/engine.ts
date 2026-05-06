import { 
  GameState, 
  TileType, 
  BuildingType, 
  BUILDINGS, 
  GRID_SIZE, 
  TILE_SIZE, 
  MAP_SIZE,
  BASES
} from './constants';
import { Warden, Building, Demon, Projectile, Entity, LesserDemon, AIStrategy } from './entities';
import { Vector2, worldToGrid } from './utils';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gameState: GameState = GameState.MENU;
  
  grid: number[][] = [];
  player: Warden;
  aiWardens: Warden[] = [];
  buildings: Building[] = [];
  projectiles: Projectile[] = [];
  demon: Demon | null = null;
  lesserDemons: LesserDemon[] = [];
  baseMap: (string | null)[][] = [];
  
  camera: Vector2 = new Vector2(0, 0);
  zoom: number = 1.0;
  timer: number = 0;
  prepPhase: boolean = true;
  lastTime: number = 0;
  _selectedTile: {x: number, y: number} | null = null;
  
  // Input
  keys: Set<string> = new Set();
  joystick: Vector2 = new Vector2(0, 0);
  mouse: Vector2 = new Vector2(0, 0);

  flyingTexts: {x: number, y: number, text: string, color: string, life: number, vy: number}[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initMap();
    
    // Start all at the center crossroads
    const centerX = (GRID_SIZE / 2) * TILE_SIZE;
    const centerY = (GRID_SIZE / 2) * TILE_SIZE;
    
    this.player = new Warden(centerX, centerY);
    this.player.claimedBaseId = null; // Start unclaimed
    
    this.camera.x = this.player.pos.x - (window.innerWidth / 2) / this.zoom;
    this.camera.y = this.player.pos.y - (window.innerHeight / 2) / this.zoom;
    
    // Add AI Wardens - start them in the center too
    const strategies: AIStrategy[] = ['Balanced', 'Greedy', 'Fortress', 'Elite'];
    for (let i = 0; i < 3; i++) {
      const warden = new Warden(centerX + (Math.random() - 0.5) * 150, centerY + (Math.random() - 0.5) * 150, true);
      warden.claimedBaseId = null;
      warden.strategy = strategies[i] || 'Balanced';
      this.aiWardens.push(warden);
    }
    this.initAtmosphere();
  }

  addFlyingText(x: number, y: number, text: string, color: string) {
    this.flyingTexts.push({ x, y, text, color, life: 1.5, vy: -0.8 });
  }

  fireflies: {x: number, y: number, phase: number, speed: number}[] = [];

  initAtmosphere() {
    for (let i = 0; i < 60; i++) {
       this.fireflies.push({
         x: Math.random() * MAP_SIZE,
         y: Math.random() * MAP_SIZE,
         phase: Math.random() * Math.PI * 2,
         speed: Math.random() * 0.02 + 0.01
       });
    }
  }

  initMap() {
    this.grid = [];
    this.baseMap = [];
    
    // 1. Fill entire grid with dense forest trees
    for (let y = 0; y < GRID_SIZE; y++) {
      this.grid[y] = Array(GRID_SIZE).fill(TileType.TREE);
      this.baseMap[y] = Array(GRID_SIZE).fill(null);
    }

    // 2. Carve Global Crossroads (The Main Roads) - 4 units wide
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 30; j <= 33; j++) {
            this.grid[i][j] = TileType.CLEARING; // Vertical road
            this.grid[j][i] = TileType.CLEARING; // Horizontal road
        }
    }

    // 3. Precise Base Generation
    BASES.forEach(base => {
        base.tiles = [];
        // Clear the Sanctum Heart - 5x5 area
        for (let y = base.centerY - 2; y <= base.centerY + 2; y++) {
            for (let x = base.centerX - 2; x <= base.centerX + 2; x++) {
                if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                    this.grid[y][x] = TileType.CLEARING;
                    this.baseMap[y][x] = base.id;
                    base.tiles.push({ x, y });
                }
            }
        }

        // Carve entrance path leading to the crossroads (1 unit wide)
        if (base.centerY < 32) { // North bases (Entrance to the South)
            for (let y = base.centerY + 2; y <= base.centerY + 5; y++) {
                if (y < 30) {
                    this.grid[y][base.centerX] = TileType.CLEARING;
                    this.baseMap[y][base.centerX] = base.id;
                    base.tiles.push({ x: base.centerX, y });
                }
            }
            for (let y = base.centerY + 6; y < 30; y++) {
                this.grid[y][base.centerX] = TileType.CLEARING;
            }
        } else { // South bases (Entrance to the North)
            for (let y = base.centerY - 5; y <= base.centerY - 2; y++) {
                if (y > 33) {
                    this.grid[y][base.centerX] = TileType.CLEARING;
                    this.baseMap[y][base.centerX] = base.id;
                    base.tiles.push({ x: base.centerX, y });
                }
            }
            for (let y = 33; y < base.centerY - 5; y++) {
                this.grid[y][base.centerX] = TileType.CLEARING;
            }
        }
    });

    // 4. Clear Demon Spawn Pit
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    for (let y = cy - 6; y <= cy + 6; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (this.grid[y] && this.grid[y][x] !== undefined) {
          this.grid[y][x] = TileType.CLEARING;
        }
      }
    }
  }

  checkFKMilestones(owner: Warden, b: Building) {
    // Determine "Level" based on evolution depth
    let level = 1;
    const stats = BUILDINGS[b.type];
    const label = stats.label;
    if (label.includes('Empire') || label.includes('Treasury') || label.includes('Mythic') || label.includes('Phoenix') || label.includes('Blizzard') || label.includes('Eternal')) level = 5;
    else if (label.includes('Corp') || label.includes('Excavation') || label.includes('Obsidian') || label.includes('Inferno') || label.includes('Titanium') || label.includes('Siege') || label.includes('Soulguard')) level = 4;
    else if (label.includes('Factory') || label.includes('Divine') || label.includes('Iron') || label.includes('Spire') || label.includes('Longbow') || label.includes('Sniper') || label.includes('Napalm') || label.includes('Freeze') || label.includes('Bastion')) level = 3;
    else if (label.includes('Yard') || label.includes('Enchanted') || label.includes('Stone') || label.includes('Archer') || label.includes('Bomb') || label.includes('Frost') || label.includes('Fire') || label.includes('Mill') || label.includes('Rapid') || label.includes('Heavy') || label.includes('Ice') || label.includes('Blaze')) level = 2;

    // Milestones are per player per match, capped at 3 total knowledge points
    // Knowledge earned at Tiers 3, 4, and 5 (Later progression)
    [3, 4, 5].forEach(milestone => {
        if (level >= milestone && !owner.fkMilestonesReached.has(milestone) && owner.forbiddenKnowledge < 3) {
            owner.forbiddenKnowledge += 1;
            owner.fkMilestonesReached.add(milestone);
            console.log(`Player earned Forbidden Knowledge! Tier Milestone: ${milestone}`);
            this.cameraShake = 15;
            this.addFlyingText(b.pos.x, b.pos.y - 60, "+1 KNOWLEDGE", "#a855f7");
        }
    });
  }

  safeSetTile(y: number, x: number, type: TileType) {
    if (this.grid[y] && this.grid[y][x] !== undefined) {
      this.grid[y][x] = type;
    }
  }

  isTileWalkable(gx: number, gy: number, entity?: Entity): boolean {
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return false;
    
    const tile = this.grid[gy][gx];
    
    // Hard blocks for everyone: Trees and Stones
    if (tile === TileType.TREE) return false;
    if (tile === TileType.STONE) {
       // Demon can traverse stone (Scorched Earth) in the center zone
       if (entity instanceof Demon && gx >= 20 && gx <= 44 && gy >= 20 && gy <= 44) return true;
       return false;
    }
    
    if (tile === TileType.WALL) {
       const building = this.getBuildingAt(gx, gy);
       // Owner can walk through their own buildings
       if (building && entity instanceof Warden && building.owner === entity) return true;
       // Demon can path through buildings to reach target (will attack them when blocked in movement)
       if (entity instanceof Demon) return true;
       return false;
    }
    return true;
  }

  findPath(start: Vector2, target: Vector2, entity?: Entity): Vector2[] | null {
    const { gx: startGx, gy: startGy } = worldToGrid(start.x, start.y);
    const { gx: targetGx, gy: targetGy } = worldToGrid(target.x, target.y);

    if (startGx === targetGx && startGy === targetGy) return null;

    const openList: { gx: number, gy: number, f: number, g: number, parent: any }[] = [];
    const closedSet = new Set<string>();
    
    openList.push({ gx: startGx, gy: startGy, f: 0, g: 0, parent: null });

    while (openList.length > 0) {
      // Sort to get best node
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      const key = `${current.gx},${current.gy}`;

      if (current.gx === targetGx && current.gy === targetGy) {
        // Reconstruct path
        const path: Vector2[] = [];
        let temp = current;
        while (temp.parent) {
          path.push(new Vector2(temp.gx * TILE_SIZE + TILE_SIZE/2, temp.gy * TILE_SIZE + TILE_SIZE/2));
          temp = temp.parent;
        }
        return path.reverse();
      }

      closedSet.add(key);

      const neighbors = [
        {gx: current.gx + 1, gy: current.gy},
        {gx: current.gx - 1, gy: current.gy},
        {gx: current.gx, gy: current.gy + 1},
        {gx: current.gx, gy: current.gy - 1}
      ];

      for (const neighbor of neighbors) {
        const nKey = `${neighbor.gx},${neighbor.gy}`;
        if (closedSet.has(nKey)) continue;
        if (!this.isTileWalkable(neighbor.gx, neighbor.gy, entity)) continue;

        const g = current.g + 1;
        const h = Math.abs(neighbor.gx - targetGx) + Math.abs(neighbor.gy - targetGy);
        const f = g + h;

        const existing = openList.find(o => o.gx === neighbor.gx && o.gy === neighbor.gy);
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        } else {
          openList.push({ ...neighbor, g, f, parent: current });
        }
      }
      
      // Limit search to prevent hangs - Demon needs a bigger search space for cross-map paths
      if (closedSet.size > 8000) break;
    }

    return null;
  }

  start() {
    this.gameState = GameState.PLAYING;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(now: number) {
    if (this.gameState !== GameState.PLAYING) return;
    
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    this.update(dt);
    this.updateFlyingTexts(dt);
    this.draw();
    
    requestAnimationFrame(this.loop.bind(this));
  }

  updateFlyingTexts(dt: number) {
    this.flyingTexts = this.flyingTexts.filter(t => {
      t.y += t.vy;
      t.life -= dt * 0.7;
      return t.life > 0;
    });
  }

  update(dt: number) {
    this.timer += dt;
    
    // Demon spawn logic - DRAMATIC
    if (this.prepPhase && this.timer > 90) { // Changed to 90s to match HUD
      this.prepPhase = false;
      this.spawnDemon();
    }

    this.handleInput(dt);
    this.updateEntities(dt);
    this.updateCamera(dt);
    this.updateEconomy(dt);
    this.checkBaseClaiming();
    this.enforceBaseBorders();
    
    // Auto-enforce lumbering if player has a base - REMOVED AS REQUESTED
    /*
    if (this.player.claimedBaseId) {
        this.player.isLumbering = true;
    }
    */
    
    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake *= 0.9;
      if (this.cameraShake < 0.1) this.cameraShake = 0;
    }
  }

  cameraShake: number = 0;

  spawnDemon() {
    this.demon = new Demon(MAP_SIZE / 2, MAP_SIZE / 2);
    this.cameraShake = 30;
    
    // The center Crossroads (The Demon's Pit)
    const midX = GRID_SIZE / 2;
    const midY = GRID_SIZE / 2;
    const radius = 8;
    for (let y = Math.floor(midY - radius); y <= Math.ceil(midY + radius); y++) {
      for (let x = Math.floor(midX - radius); x <= Math.ceil(midX + radius); x++) {
         const dx = x - midX;
         const dy = y - midY;
         if (Math.sqrt(dx*dx + dy*dy) <= radius) {
            // Scorched Earth: Walkable by Demon, but visually distinct
            // We use STONE as a visual floor that the Demon can traverse but others might not
            this.safeSetTile(y, x, TileType.CLEARING);
         }
      }
    }
  }

  checkBaseClaiming() {
    [this.player, ...this.aiWardens].forEach(w => {
      if (w.claimedBaseId) return;
      
      const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
      const baseId = this.baseMap[gy] ? this.baseMap[gy][gx] : null;
      
      if (baseId) {
        const base = BASES.find(b => b.id === baseId);
        if (!base) return;

        // Check if this base is already taken by someone else
        const isTaken = [this.player, ...this.aiWardens].some(other => other.claimedBaseId === baseId);
        if (isTaken) return;

        // Claim logic
        w.claimedBaseId = baseId;
        
        // Telegram: TELEPORT ALL OTHER BUILDERS OUT
        this.teleportTrespassers(baseId, w);

        // SPAWN SACRED ALTAR at center if empty
        const existing = this.getBuildingAt(base.centerX, base.centerY);
        if (!existing) {
          const altar = new Building(base.centerX, base.centerY, BuildingType.SACRED_ALTAR, w);
          this.buildings.push(altar);
          this.grid[base.centerY][base.centerX] = TileType.WALL;
        }

        // LOCK WARDEN TO ALTAR - REMOVED
        const finalAltar = this.buildings.find(b => b.gridX === base.centerX && b.gridY === base.centerY);
        if (finalAltar) {
          // w.isLumbering = true;
          w.pos.x = finalAltar.pos.x;
          w.pos.y = finalAltar.pos.y;
        }
      }
    });
  }

  teleportTrespassers(baseId: string, claimant: Warden) {
    [this.player, ...this.aiWardens].forEach(w => {
      if (w !== claimant && w.claimedBaseId !== baseId) {
        const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
        if (this.baseMap[gy]?.[gx] === baseId) {
          const base = BASES.find(b => b.id === baseId);
          if (base) {
             const exitX = base.entranceX * TILE_SIZE + TILE_SIZE/2;
             const exitY = (base.entranceY + (base.entranceY > base.centerY ? 2 : -2)) * TILE_SIZE + TILE_SIZE/2;
             w.pos.x = exitX;
             w.pos.y = exitY;
             if (w instanceof Warden && w.isAI) w.targetPos = null;
             // w.isLumbering = false;
          }
        }
      }
    });
  }

  enforceBaseBorders() {
    [this.player, ...this.aiWardens].forEach(w => {
        const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
        const baseId = this.baseMap[gy] ? this.baseMap[gy][gx] : null;
        if (baseId) {
            const owner = [this.player, ...this.aiWardens].find(o => o.claimedBaseId === baseId);
            if (owner && owner !== w) {
                // Trespasser! Push out.
                const dirFromCenter = new Vector2(w.pos.x - (gx * TILE_SIZE), w.pos.y - (gy * TILE_SIZE)).normalize();
                w.pos.x += dirFromCenter.x * 10;
                w.pos.y += dirFromCenter.y * 10;
                
                // If deep inside, just teleport to crossroads
                const base = BASES.find(b => b.id === baseId);
                if (base && w.pos.distanceTo(new Vector2(base.centerX * TILE_SIZE, base.centerY * TILE_SIZE)) < 150) {
                    this.teleportTrespassers(baseId, owner);
                }
            }
        }
    });
  }

  handleInput(dt: number) {
    const move = new Vector2(0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;

    // Joystick override
    if (this.joystick.length() > 0.1) {
      move.x = this.joystick.x;
      move.y = this.joystick.y;
    }

    if (this.player.claimedBaseId) {
       const base = BASES.find(b => b.id === this.player.claimedBaseId);
       if (base) {
         const altar = this.buildings.find(b => b.gridX === base.centerX && b.gridY === base.centerY);
         if (altar) {
           this.player.pos.x = altar.pos.x;
           this.player.pos.y = altar.pos.y;

           if (move.length() > 0) {
             const panSpeed = 15 * (dt * 60) / this.zoom;
             this.camera.x += move.x * panSpeed;
             this.camera.y += move.y * panSpeed;
             this.panningActive = true;
           }
         }
       }
       // Note: Mouse panning continues below
    }

    if (move.length() > 0 && !this.player.claimedBaseId) {
        this.panningActive = false; // Keep camera centered while moving manually (unlocked)
        
        move.normalize();
        const speed = this.player.speed * (dt * 60);
        const nextX = this.player.pos.x + move.x * speed;
        const nextY = this.player.pos.y + move.y * speed;
        
        if (this.canMoveTo(nextX, nextY, this.player.radius, this.player)) {
          this.player.pos.x = nextX;
          this.player.pos.y = nextY;
        } else if (this.canMoveTo(nextX, this.player.pos.y, this.player.radius, this.player)) {
          this.player.pos.x = nextX;
        } else if (this.canMoveTo(this.player.pos.x, nextY, this.player.radius, this.player)) {
          this.player.pos.y = nextY;
        }
    }

    // Camera Panning Logic (Mouse/Drag)
    if (this.isPanning && this.lastMousePos) {
       const dx = (this.mouse.x - this.lastMousePos.x) / this.zoom;
       const dy = (this.mouse.y - this.lastMousePos.y) / this.zoom;
       this.camera.x -= dx;
       this.camera.y -= dy;
       this.panningActive = true;
       this.lastMousePos = new Vector2(this.mouse.x, this.mouse.y);
    }
    
    // Keep player in bounds
    this.player.pos.x = Math.max(0, Math.min(MAP_SIZE, this.player.pos.x));
    this.player.pos.y = Math.max(0, Math.min(MAP_SIZE, this.player.pos.y));
  }

  isPanning = false;
  lastMousePos: Vector2 | null = null;
  panningActive = false;

  snapToPlayer() {
    this.panningActive = false;
    const targetX = this.player.pos.x - (this.canvas.width / 2) / this.zoom;
    const targetY = this.player.pos.y - (this.canvas.height / 2) / this.zoom;
    this.camera.x = targetX;
    this.camera.y = targetY;
  }

  canMoveTo(x: number, y: number, radius: number, entity?: Entity): boolean {
    const points = [
      { x: x, y: y }, // Center
      { x: x - radius, y: y - radius },
      { x: x + radius, y: y - radius },
      { x: x - radius, y: y + radius },
      { x: x + radius, y: y + radius }
    ];

    for (const p of points) {
      const { gx, gy } = worldToGrid(p.x, p.y);
      if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return false;
      
      const tile = this.grid[gy][gx];
      
      if (entity instanceof Demon) {
        // Demon ignores stone and road collision constraints at the center
      }

      if (tile === TileType.TREE || tile === TileType.STONE) return false;
      
      if (tile === TileType.WALL) {
        const building = this.buildings.find(b => b.gridX === gx && b.gridY === gy);
        // Owner Warden can move through their own buildings with a bit of leniency
        if (building && entity instanceof Warden && building.owner === entity) return true;
        return false;
      }
    }
    return true;
  }

  updateEntities(dt: number) {
    const now = performance.now();

    // Projectiles
    this.projectiles = this.projectiles.filter(p => {
      const hit = p.update();
      if (hit) {
        if (p.isBomb) {
          // Splash Damage
          const splashRange = 120;
          this.lesserDemons.forEach(ld => {
            if (ld.pos.distanceTo(p.pos) < splashRange) {
              ld.takeDamage(p.damage * 0.6);
            }
          });
          if (this.demon && !this.demon.isDead && this.demon.pos.distanceTo(p.pos) < splashRange) {
             this.demon.takeDamage(p.damage * 0.4);
          }
        }
        p.target.takeDamage(p.damage);
        return false;
      }
      return !p.target.isDead;
    });

    // AI Wardens
    this.aiWardens = this.aiWardens.filter(w => {
      if (w.isDead) {
        this.lesserDemons.push(new LesserDemon(w.pos.x, w.pos.y));
        return false;
      }
      this.updateAIWarden(w, dt);
      return true;
    });

    // Buildings
    const beforeCount = this.buildings.length;
    const deadBuildings = this.buildings.filter(b => b.hp <= 0);
    this.buildings = this.buildings.filter(b => b.hp > 0);
    
    if (this.buildings.length < beforeCount) {
      this.cameraShake = 10;
      deadBuildings.forEach(b => {
        this.grid[b.gridY][b.gridX] = TileType.CLEARING;
        // SACRED ALTAR DEATH LOGIC
        if (b.type === BuildingType.SACRED_ALTAR && b.owner) {
          b.owner.isDead = true;
          this.addFlyingText(b.pos.x, b.pos.y, "DOMAIN FALLEN", "#ef4444");
        }
      });
    }

    // Since I can't easily track who was filtered out without a temp array:
    const remainingIds = new Set(this.buildings.map(b => `${b.gridX},${b.gridY}`));
    // Re-scanning grid is overkill, but we need to reset TileType.WALL if building is gone
    // Let's do it properly:
    // ... wait, I'll just iterate over all buildings and if they are gone we'll know later.
    // Actually, I'll do this in a better way below.

    this.buildings.forEach(b => {
      const stats = BUILDINGS[b.type];
      const owner = b.owner;
      
      // Apply Building Local Upgrades + Global Research
      const globalDefenseBonus = 1 + (owner.upgrades?.defense || 0) * 0.1;
      const bDefUpgrade = (b.upgrades?.defense || 0);
      const defenseBonus = (1 + bDefUpgrade * 0.2) * globalDefenseBonus;
      
      if (b.maxHp !== stats.maxHp * defenseBonus) {
        const ratio = b.maxHp > 0 ? b.hp / b.maxHp : 1;
        b.maxHp = stats.maxHp * defenseBonus;
        b.hp = b.maxHp * ratio;
      }
      
      // Auto-Attack logic
      if (stats.range) {
        const cooldown = (stats.cooldown || 1000);

        if (now - b.lastActionTime > cooldown) {
          // Find closest target
          let target: Entity | null = null;
          let minDist = (stats.range || 0) * TILE_SIZE;

          // Target Prioritization: Demon first if in range
          if (this.demon && !this.demon.isDead) {
            const d = b.pos.distanceTo(this.demon.pos);
            if (d < minDist) {
              target = this.demon;
              // Don't reduce minDist if it's the demon, let it be the priority
            }
          }

          if (!target) {
            this.lesserDemons.forEach(ld => {
              const d = b.pos.distanceTo(ld.pos);
              if (d < minDist) {
                target = ld;
                minDist = d;
              }
            });
          }

          if (target) {
            if (stats.range && stats.damage) {
              const globalOffenseBonus = 1 + (owner.upgrades?.offense || 0) * 0.08;
              const damageBonus = (1 + b.upgrades.offense * 0.2) * globalOffenseBonus;
              const damage = (stats.damage || 0) * damageBonus;

              // Projectiles for splash damage buildings (BOMB branch)
              const isSplash = b.type.includes('BOMB') || b.type.includes('NAPALM') || b.type.includes('CLUSTER');
              this.projectiles.push(new Projectile(
                b.pos.x, b.pos.y, target, damage, isSplash,
                stats.projectileColor, stats.projectileSpeed, stats.projectileSize
              ));
            } else if (b.type === BuildingType.REPAIR_HUT) {
              const repairAmount = 20 * (1 + b.upgrades.defense * 0.1) * globalDefenseBonus;
              this.buildings.forEach(other => {
                if (other !== b && other.pos.distanceTo(b.pos) < stats.range! * TILE_SIZE) {
                  other.hp = Math.min(other.maxHp, other.hp + repairAmount);
                }
              });
            }
            b.lastActionTime = now;
          }
        }
      }
    });

    // Handle removal effects and grid sync
    // For every building that was alive last frame but not this frame, set grid to Clearing
    // (This works as long as nothing else sets WALLs)
    // Actually simpler: if a building's HP hits 0, the engine should handle it.
    // I'll add a check in the main loop to clean up the grid.

    // Demon
    if (this.demon && !this.demon.isDead) {
      this.updateDemonAI(dt);
    }

    // Lesser Demons
    this.lesserDemons.forEach(ld => {
      this.updateLesserDemonAI(ld, dt);
    });
  }

  updateAIWarden(w: Warden, dt: number) {
    const now = performance.now();
    
    // 1. Goal Setting (Find/Claim Base)
    if (!w.claimedBaseId && !w.targetPos) {
      const unclaimed = BASES.find(base => 
        !this.aiWardens.some(other => other !== w && (other.claimedBaseId === base.id || (other.targetPos && worldToGrid(other.targetPos.x, other.targetPos.y).gx === base.centerX))) && 
        this.player.claimedBaseId !== base.id &&
        !(this.player.targetPos && worldToGrid(this.player.targetPos.x, this.player.targetPos.y).gx === base.centerX)
      );
      
      if (unclaimed) {
        w.targetPos = new Vector2(unclaimed.centerX * TILE_SIZE + TILE_SIZE/2, unclaimed.centerY * TILE_SIZE + TILE_SIZE/2);
        w.path = this.findPath(w.pos, w.targetPos, w);
        w.pathIndex = 0;
      }
    }

    // 2. Movement along Path
    if (w.path && w.pathIndex < w.path.length) {
      const target = w.path[w.pathIndex];
      const dir = new Vector2(target.x - w.pos.x, target.y - w.pos.y);
      const dist = dir.length();
      
      if (dist < 15) {
        w.pathIndex++;
      } else {
        const speed = w.speed * (dt * 60);
        const moveDir = dir.normalize();
        
        const nextX = w.pos.x + moveDir.x * speed;
        const nextY = w.pos.y + moveDir.y * speed;
        
        if (this.canMoveTo(nextX, nextY, w.radius, w)) {
          w.pos.x = nextX;
          w.pos.y = nextY;
          w.stuckTime = 0;
        } else {
          // If blocked, recalculate path periodically
          w.stuckTime += dt;
          if (w.stuckTime > 1.0) {
            w.path = this.findPath(w.pos, w.targetPos!, w);
            w.pathIndex = 0;
            w.stuckTime = 0;
          }
        }
      }
    } else if (w.targetPos) {
       // Manual target reaching (for final nudge)
       const dist = w.pos.distanceTo(w.targetPos);
       if (dist < 20) {
          const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
          const baseId = this.baseMap[gy]?.[gx];
          if (baseId && !w.claimedBaseId) {
             this.claimBase(w, baseId);
          }
          w.targetPos = null;
          w.path = null;
       } else {
         // Path lost? Retry find path
         w.path = this.findPath(w.pos, w.targetPos, w);
         w.pathIndex = 0;
       }
    } else if (w.claimedBaseId) {
      // 3. Economy & Building Logic
      const base = BASES.find(b => b.id === w.claimedBaseId);
      if (base) {
        // Strategy-based logic
        const baseBuildings = this.buildings.filter(b => b.owner === w);
        const lumberCount = baseBuildings.filter(b => b.type.includes('LUMBER')).length;
        const goldCount = baseBuildings.filter(b => b.type.includes('GOLD_MINE') || b.type.includes('FORBIDDEN_EXCAVATION') || b.type.includes('DIVINE_MINE')).length;
        const towerCount = baseBuildings.filter(b => b.type.includes('TOWER')).length;
        const wallCount = baseBuildings.filter(b => b.type.includes('WALL')).length;

        // Action timer (don't build too fast)
        if (now - w.baseDecisionTimer < 2500) return;
        w.baseDecisionTimer = now;

        // HIGH PRIORITY: Wall the entrance
        const entranceX = base.entranceX;
        const entranceY = base.entranceY;
        const hasEntranceWall = baseBuildings.some(b => b.gridX === entranceX && b.gridY === entranceY);
        
        if (!hasEntranceWall && w.wood >= 40) {
          this.placeBuilding(entranceX, entranceY, BuildingType.WOOD_WALL, w);
          return;
        }

        // Upgrade Check (Elite strategy upgrades existing towers before building more)
        const upgradeable = baseBuildings.find(b => {
           const stats = BUILDINGS[b.type];
           return stats.upgradesTo && stats.upgradesTo.length > 0 && w.wood >= BUILDINGS[stats.upgradesTo[0]].costWood && w.gold >= BUILDINGS[stats.upgradesTo[0]].costGold;
        });

        if (upgradeable && (w.strategy === 'Elite' || Math.random() > 0.6)) {
            const nextType = BUILDINGS[upgradeable.type].upgradesTo![0];
            upgradeable.evolve(nextType);
            w.wood -= BUILDINGS[nextType].costWood;
            w.gold -= BUILDINGS[nextType].costGold;
            this.addFlyingText(upgradeable.pos.x, upgradeable.pos.y, "UPGRADE!", "#facc15");
            return;
        }

        // Determine what to build next
        let typeToBuild: BuildingType | null = null;
        if (lumberCount < 1) typeToBuild = BuildingType.LUMBER_MILL;
        else if (goldCount < 1 && w.wood >= 150) typeToBuild = BuildingType.GOLD_MINE;
        else if (wallCount < 1 && w.wood >= 50) typeToBuild = BuildingType.WOOD_WALL;
        else if (towerCount < 1 && w.wood >= 150) typeToBuild = BuildingType.GUARD_TOWER;
        else {
          const rand = Math.random();
          if (w.strategy === 'Greedy' && lumberCount < 6 && rand > 0.3) typeToBuild = BuildingType.LUMBER_MILL;
          else if (w.strategy === 'Greedy' && goldCount < 4 && rand > 0.3) typeToBuild = BuildingType.GOLD_MINE;
          else if (w.strategy === 'Fortress' && wallCount < 12 && rand > 0.4) typeToBuild = BuildingType.WOOD_WALL;
          else if (w.strategy === 'Swarm' && towerCount < 10 && rand > 0.4) typeToBuild = BuildingType.GUARD_TOWER;
          else if (rand > 0.8) typeToBuild = BuildingType.GUARD_TOWER;
          else if (rand > 0.5 && goldCount < 3) typeToBuild = BuildingType.GOLD_MINE;
        }

        if (typeToBuild) {
          const stats = BUILDINGS[typeToBuild];
          if (w.wood >= stats.costWood && w.gold >= stats.costGold) {
            const emptyTile = base.tiles.find(t => !this.getBuildingAt(t.x, t.y));
            if (emptyTile) {
              this.placeBuilding(emptyTile.x, emptyTile.y, typeToBuild, w);
            }
          }
        } else {
            // Idle: Move back to the resource center (mill) if not there
            const millPos = new Vector2(base.centerX * TILE_SIZE + TILE_SIZE/2, base.centerY * TILE_SIZE + TILE_SIZE/2);
            if (w.pos.distanceTo(millPos) > 40) {
               w.targetPos = millPos;
            }
        }
      }
    }
  }

  placeBuilding(gx: number, gy: number, type: BuildingType, owner: Warden): boolean {
    const stats = BUILDINGS[type];
    if (owner.wood >= stats.costWood && owner.gold >= (stats.costGold || 0)) {
      const exists = this.buildings.some(b => b.gridX === gx && b.gridY === gy);
      if (!exists && this.grid[gy][gx] === TileType.CLEARING) {
        const b = new Building(gx, gy, type, owner);
        this.buildings.push(b);
        owner.wood -= stats.costWood;
        owner.gold -= (stats.costGold || 0);
        this.grid[gy][gx] = TileType.WALL;
        return true;
      }
    }
    return false;
  }

  claimBase(warden: Warden, baseId: string) {
    if (warden.claimedBaseId) return;
    
    // Check if base is already claimed
    const isClaimed = [this.player, ...this.aiWardens].some(w => w.claimedBaseId === baseId);
    if (isClaimed) return;

    const base = BASES.find(b => b.id === baseId);
    if (base) {
      warden.claimedBaseId = baseId;
      // Spawn Sacred Altar in the center
      const b = new Building(base.centerX, base.centerY, BuildingType.SACRED_ALTAR, warden);
      this.buildings.push(b);
      this.grid[base.centerY][base.centerX] = TileType.WALL;
      this.addFlyingText(b.pos.x, b.pos.y, "SACRED HEART UNLOCKED", "#a855f7");
    }
  }

  updateDemonAI(dt: number) {
    if (!this.demon) return;
    const now = performance.now();

    // Corruption trail
    if (this.timer % 0.5 < 0.1) {
      this.demon.corruptionTrail.push(new Vector2(this.demon.pos.x, this.demon.pos.y));
      if (this.demon.corruptionTrail.length > 20) this.demon.corruptionTrail.shift();
    }

    // Passive XP and level up
    this.demon.xp += 1.0 * dt; 
    if (this.demon.xp >= 100) {
      this.levelUpDemon();
    }

    // State Transitions
    const altarPos = new Vector2(MAP_SIZE / 2, MAP_SIZE / 2);
    
    // Aggression: Switch targets if stayed too long
    if (this.demon.state === 'HUNT') {
        this.demon.targetLockedTime = (this.demon.targetLockedTime || 0) + dt;
        if (this.demon.targetLockedTime > 15) {
            this.demon.targetLockedTime = 0;
            this.demon.lastTargetId = this.demon.currentTarget?.id || null;
            this.demon.currentTarget = null; // Forces re-targeting next frame
        }
    }

    if (this.demon.hp < this.demon.maxHp * 0.35 && this.demon.state === 'HUNT') {
      this.demon.state = 'RETREAT';
      this.addFlyingText(this.demon.pos.x, this.demon.pos.y - 40, "RETRYING...", "#ef4444");
    }

    if (this.demon.state === 'RETREAT') {
      const dirToAltar = new Vector2(altarPos.x - this.demon.pos.x, altarPos.y - this.demon.pos.y);
      const d = dirToAltar.length();
      
      if (d > 20) {
        dirToAltar.normalize();
        const nextX = this.demon.pos.x + dirToAltar.x * this.demon.speed * 1.8 * (dt * 60);
        const nextY = this.demon.pos.y + dirToAltar.y * this.demon.speed * 1.8 * (dt * 60);
        
        if (this.canMoveTo(nextX, nextY, this.demon.radius, this.demon)) {
          this.demon.pos.x = nextX;
          this.demon.pos.y = nextY;
        } else {
           // Sliding
           if (this.canMoveTo(nextX, this.demon.pos.y, this.demon.radius, this.demon)) this.demon.pos.x = nextX;
           else if (this.canMoveTo(this.demon.pos.x, nextY, this.demon.radius, this.demon)) this.demon.pos.y = nextY;
        }
      } else {
        this.demon.state = 'REGEN';
        this.addFlyingText(this.demon.pos.x, this.demon.pos.y - 40, "HEALING AT ALTAR", "#10b981");
      }
    } else if (this.demon.state === 'REGEN') {
      // Heal quickly at altar
      if (now - this.demon.lastRegenTime > 100) {
        const healAmt = this.demon.maxHp * 0.02;
        this.demon.hp = Math.min(this.demon.maxHp, this.demon.hp + healAmt);
        this.demon.lastRegenTime = now;
        
        if (this.demon.hp >= this.demon.maxHp) {
            this.demon.state = 'HUNT';
            this.levelUpDemon(); // Level up after full heal
            this.addFlyingText(this.demon.pos.x, this.demon.pos.y - 40, "ASCENDED", "#facc15");
        }
      }
      
      // Wander slightly around altar
      this.demon.pos.x += (Math.random() - 0.5) * 2;
      this.demon.pos.y += (Math.random() - 0.5) * 2;
    } else {
      // Hunt State: Intelligent targeting
      let target: any = null;
      let minTargetDist = 20000;

      // Target Selection Strategy
      // 1. High Priority: Sacred Hearts/Altars (Primary objective)
      this.buildings.forEach(b => {
        if (b.type === BuildingType.SACRED_ALTAR) {
          const d = this.demon!.pos.distanceTo(b.pos);
          if (d < minTargetDist) {
            minTargetDist = d;
            target = b;
          }
        }
      });

      // 2. Secondary Priority: Players (Warden) if they are close
      [this.player, ...this.aiWardens].filter(p => !p.isDead).forEach(p => {
        const d = this.demon!.pos.distanceTo(p.pos);
        if (d < 1200 && d < minTargetDist) {
          minTargetDist = d;
          target = p;
        }
      });
      
      // 3. Fallback: Any other building
      if (!target) {
        this.buildings.forEach(b => {
          const d = this.demon!.pos.distanceTo(b.pos);
          if (d < minTargetDist) {
             minTargetDist = d;
             target = b;
          }
        });
      }
      
      if (!target) {
        // No targets? Patrol between bases
        const baseIndex = Math.floor(now / 5000) % BASES.length;
        const patrolBase = BASES[baseIndex];
        const patrolX = patrolBase.centerX * TILE_SIZE + TILE_SIZE/2;
        const patrolY = patrolBase.centerY * TILE_SIZE + TILE_SIZE/2;
        
        target = { pos: new Vector2(patrolX, patrolY), id: 'patrol' };
      }
      
      this.demon.currentTarget = target;

      // Pathing execution
      this.demon.pathTimer = (this.demon.pathTimer || 0) + dt;
      if (!this.demon.path || this.demon.pathTimer > 1.5) {
        this.demon.path = this.findPath(this.demon.pos, target.pos, this.demon);
        this.demon.pathIndex = 0;
        this.demon.pathTimer = 0;
      }

      const dist = this.demon.pos.distanceTo(target.pos);
      
      if (dist < this.demon.attackRange) {
        if (now - this.demon.lastAttackTime > this.demon.attackCooldown) {
          this.attackTarget(this.demon, target, now);
        }
      } else if (this.demon.path && this.demon.pathIndex < this.demon.path.length) {
        const pathTarget = this.demon.path[this.demon.pathIndex];
        const pathDir = new Vector2(pathTarget.x - this.demon.pos.x, pathTarget.y - this.demon.pos.y);
        const pathDist = pathDir.length();

        if (pathDist < 15) {
          this.demon.pathIndex++;
        } else {
          const speed = this.demon.speed * (dt * 60);
          const moveDir = pathDir.normalize();
          const nextX = this.demon.pos.x + moveDir.x * speed;
          const nextY = this.demon.pos.y + moveDir.y * speed;

          if (this.canMoveTo(nextX, nextY, this.demon.radius, this.demon)) {
            this.demon.pos.x = nextX;
            this.demon.pos.y = nextY;
            this.demon.stuckDuration = 0;
          } else {
            // Aggressive clearing: Target ANY blocker in the way!
            // Check center and edges to find what's stopping us
            const checkPoints = [
              { x: nextX, y: nextY },
              { x: nextX + this.demon.radius, y: nextY },
              { x: nextX - this.demon.radius, y: nextY },
              { x: nextX, y: nextY + this.demon.radius },
              { x: nextX, y: nextY - this.demon.radius }
            ];

            let foundBlocker = false;
            for (const p of checkPoints) {
              const { gx: cGx, gy: cGy } = worldToGrid(p.x, p.y);
              const blocker = this.getBuildingAt(cGx, cGy);
              if (blocker) {
                if (now - this.demon.lastAttackTime > this.demon.attackCooldown) {
                  this.attackTarget(this.demon, blocker, now);
                }
                foundBlocker = true;
                break;
              }
            }

            if (!foundBlocker) {
              this.demon.stuckDuration += dt;
              if (this.demon.stuckDuration > 0.8) {
                // If stuck for too long without a direct blocker, recalculate path
                // This prevents the "walking into trees" loop
                this.demon.path = this.findPath(this.demon.pos, target.pos, this.demon);
                this.demon.pathIndex = 0;
                this.demon.stuckDuration = 0;
              }
            }
          }
        }
      } else {
        // Fallback: If no path, try to move directly but VERY carefully
        // If we hit a tree, stop immediately and wait for path recalculation
        const dir = new Vector2(target.pos.x - this.demon.pos.x, target.pos.y - this.demon.pos.y).normalize();
        const speed = this.demon.speed * (dt * 60);
        const nextX = this.demon.pos.x + dir.x * speed;
        const nextY = this.demon.pos.y + dir.y * speed;

        if (this.canMoveTo(nextX, nextY, this.demon.radius, this.demon)) {
           this.demon.pos.x = nextX;
           this.demon.pos.y = nextY;
        } else {
           // If blocked and specifically by a building, attack it
           const { gx, gy } = worldToGrid(nextX, nextY);
           const blocker = this.getBuildingAt(gx, gy);
           if (blocker && now - this.demon.lastAttackTime > this.demon.attackCooldown) {
              this.attackTarget(this.demon, blocker, now);
           }
        }
      }
    }

    // Keep demon in bounds
    this.demon.pos.x = Math.max(0, Math.min(MAP_SIZE, this.demon.pos.x));
    this.demon.pos.y = Math.max(0, Math.min(MAP_SIZE, this.demon.pos.y));

    // Anti-Stuck Nudge
    if (this.demon.pos.distanceTo(this.demon.lastStuckPos) < 1) {
      this.demon.stuckDuration += dt;
      if (this.demon.stuckDuration > 1.5) {
        this.demon.path = null; // Force path recalculation
        // Only nudge if NOT currently attacking a building
        if (now - this.demon.lastAttackTime > 500) {
           const nx = this.demon.pos.x + (Math.random() - 0.5) * 30;
           const ny = this.demon.pos.y + (Math.random() - 0.5) * 30;
           if (this.canMoveTo(nx, ny, this.demon.radius, this.demon)) {
             this.demon.pos.x = nx;
             this.demon.pos.y = ny;
           }
        }
        this.demon.stuckDuration = 0;
      }
    } else {
      this.demon.lastStuckPos = new Vector2(this.demon.pos.x, this.demon.pos.y);
      this.demon.stuckDuration = 0;
    }
  }

  levelUpDemon() {
    if (!this.demon) return;
    this.demon.level++;
    this.demon.xp = 0;
    this.demon.damage += 12; // Re-balanced from 15
    this.demon.attackSpeed += 0.2; // Re-balanced from 0.25
    this.demon.maxHp += 400; // Re-balanced from 800
    this.demon.hp = this.demon.maxHp;
    this.demon.speed += 0.15;
    // Level up after full heal
    this.demon.radius = 15; // Set a fixed, safe radius for corridor navigation
  }

  sellBuilding(b: Building) {
    const stats = BUILDINGS[b.type];
    const owner = b.owner;
    
    // Full refund
    owner.wood += stats.costWood;
    owner.gold += stats.costGold;
    
    // Clear building
    const index = this.buildings.indexOf(b);
    if (index !== -1) {
      this.buildings.splice(index, 1);
      this.grid[b.gridY][b.gridX] = TileType.CLEARING;
    }
  }

  repairBuilding(b: Building): boolean {
    if (b.hp >= b.maxHp) return false;
    const stats = BUILDINGS[b.type];
    const woodCost = Math.ceil(stats.costWood * 0.2) || 2;
    const goldCost = Math.ceil(stats.costGold * 0.2) || 0;

    if (this.player.wood >= woodCost && this.player.gold >= goldCost) {
      this.player.wood -= woodCost;
      this.player.gold -= goldCost;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.4);
      return true;
    }
    return false;
  }


  calculateDamage(target: Entity, baseDamage: number): number {
    let finalDamage = baseDamage;
    if (target instanceof Building) {
      // Manual armor levels removed. Strengthening happens via evolution tiers (HP increase).
      
      // Soulguard Tower Check (Still active as a tactical feature)
      const nearbySoulguard = this.buildings.find(b => 
        b.type === BuildingType.SOULGUARD_TOWER && 
        b.owner === target.owner && 
        b.pos.distanceTo(target.pos) < 200
      );
      if (nearbySoulguard && target !== nearbySoulguard) {
        finalDamage *= 0.5;
      }
    }
    return finalDamage;
  }

  attackTarget(demon: Demon, target: Entity, now: number) {
    if (now - demon.lastAttackTime > (1000 / demon.attackSpeed)) {
      const finalDamage = this.calculateDamage(target, demon.damage);
      target.takeDamage(finalDamage);
      this.cameraShake = 7;
      demon.lastAttackTime = now;
      
      // XP Logic: Towers give more XP to incentivize attacking defense
      let xpGain = 10;
      if (target instanceof Building) {
        const stats = BUILDINGS[target.type];
        if (stats.damage) xpGain = 25; // Tower
        else if (target.type === BuildingType.SACRED_ALTAR) xpGain = 50; // Big prize
      } else if (target instanceof Warden) {
        xpGain = 35;
      }
      
      demon.xp += xpGain;
      if (demon.xp >= 100) {
        this.levelUpDemon();
        this.addFlyingText(demon.pos.x, demon.pos.y - 60, "DOMAIN POWER SURGE", "#f43f5e");
      }
    }
  }

  updateLesserDemonAI(ld: LesserDemon, dt: number) {
    const now = performance.now();
    let target: Entity = this.player;
    let minDist = ld.pos.distanceTo(this.player.pos);
    
    this.buildings.forEach(b => {
      const d = ld.pos.distanceTo(b.pos);
      if (d < minDist) {
        minDist = d;
        target = b;
      }
    });

    const dir = new Vector2(target.pos.x - ld.pos.x, target.pos.y - ld.pos.y).normalize();
    if (minDist > 30) {
      const nextX = ld.pos.x + dir.x * ld.speed * (dt * 60);
      const nextY = ld.pos.y + dir.y * ld.speed * (dt * 60);
      if (this.canMoveTo(nextX, nextY, ld.radius, ld)) {
        ld.pos.x = nextX;
        ld.pos.y = nextY;
      }
    } else {
      if (now - ld.lastAttackTime > (1000 / ld.attackSpeed)) {
        const finalDamage = this.calculateDamage(target, ld.damage);
        target.takeDamage(finalDamage);
        ld.lastAttackTime = now;
      }
    }
  }

  updateEconomy(dt: number) {
    // Wood generation
    this.aiWardens.forEach(w => w.isLumbering = false);
    
    this.buildings.forEach(b => {
      const owner = b.owner;
      if (!owner) return;
      
      const woodRates: Record<string, number> = {
        [BuildingType.SACRED_ALTAR]: 1.0,
        [BuildingType.LUMBER_SHACK]: 1.5,
        [BuildingType.LUMBER_MILL]: 4.0,
        [BuildingType.LESSER_LOGGING_CAMP]: 8.0,
        [BuildingType.LUMBER_YARD]: 14.0,
        [BuildingType.LUMBER_FACTORY]: 32.0,
        [BuildingType.LUMBER_CORPORATION]: 75.0,
        [BuildingType.LUMBER_EMPIRE]: 220.0,
        [BuildingType.VOID_COLLECTOR]: 40.0,
        [BuildingType.ESSENCE_DISTILLER]: 25.0,
      };
 
      if (woodRates[b.type]) {
        // Automatic generation (like gold mines)
        const gained = woodRates[b.type] * dt;
        owner.wood += gained;
        
        // Manual lumbering provides x2 bonus - REMOVED
        /*
        const dist = owner.pos.distanceTo(b.pos);
        const isNear = dist < 45;
        if (isNear && (owner.isAI || (owner === this.player && this.player.isLumbering))) {
           owner.wood += gained; // Bonus
           if (owner.isAI) owner.isLumbering = true;
        }
        */
        
        b.accumulatedWood = (b.accumulatedWood || 0) + gained;
        // Display wood/gold total gain roughly every 1.0 seconds to avoid blur
        b.textTimer = (b.textTimer || 0) + dt;
        if (b.textTimer >= 1.0) {
          const amount = Math.floor(b.accumulatedWood);
          if (amount > 0) {
            this.addFlyingText(b.pos.x, b.pos.y - 40, `+${amount}`, '#10b981');
            b.accumulatedWood -= amount;
          }
          b.textTimer = 0;
        }
      }

      // Supply Node global bonus
      if (b.type === BuildingType.SUPPLY_NODE) {
          owner.wood += 5.0 * dt; // Passive global boost
      }
    });
    
    // Gold generation
    const players = [this.player, ...this.aiWardens];
    players.forEach(w => {
      if (w.isDead) return;
      
      const goldRates: Record<string, number> = {
        [BuildingType.GOLD_MINE]: 2.0,
        [BuildingType.ENCHANTED_MINE]: 8.0,
        [BuildingType.DIVINE_MINE]: 24.0,
        [BuildingType.FORBIDDEN_EXCAVATION]: 60.0,
        [BuildingType.ETERNAL_TREASURY]: 240.0,
        [BuildingType.ESSENCE_DISTILLER]: 5.0,
      };

      this.buildings.forEach(b => {
        if (b.owner === w && goldRates[b.type]) {
          const dist = w.pos.distanceTo(b.pos);
          const isGlobal = b.type === BuildingType.ESSENCE_DISTILLER;
          if (isGlobal || dist < 150) {
            const gained = goldRates[b.type] * dt;
            w.gold += gained;
            
            b.accumulatedGold = (b.accumulatedGold || 0) + gained;
            b.textTimer = (b.textTimer || 0) + dt;
            if (b.textTimer >= 1.0) {
              const amount = Math.floor(b.accumulatedGold);
              if (amount > 0) {
                this.addFlyingText(b.pos.x, b.pos.y - 40, `+${amount}`, '#fbbf24');
                b.accumulatedGold -= amount;
              }
              b.textTimer = 0;
            }
          }
        }
      });
      
      w.gold += 0.2 * dt;
    });

    // Check research unlocks for AI
    this.aiWardens.forEach(w => {
       if (w.wood > 500 && w.gold > 100) {
          // AI can naturally research if rich
          const types = [BuildingType.STONE_WALL, BuildingType.ARCHER_TOWER, BuildingType.BOMB_TOWER, BuildingType.FROST_TOWER];
          types.forEach(t => {
            if (!w.unlockedBuildings.has(t)) {
              w.wood -= 100;
              w.gold -= 20;
              w.unlockedBuildings.add(t);
            }
          });
       }
    });
  }

  updateCamera(dt: number) {
    // 1. Lock camera strictly to player before they claim a base
    if (!this.player.claimedBaseId) {
      this.camera.x = this.player.pos.x - (this.canvas.width / 2) / this.zoom;
      this.camera.y = this.player.pos.y - (this.canvas.height / 2) / this.zoom;
      this.panningActive = false;
    } else {
      // 2. After claiming, the camera is "Free Look"
      // We don't snap back automatically anymore. 
      // Movement in handleInput allows panning.
    }

    // Bounds - adjusted for zoom and giving a bit of extra margin
    const maxX = Math.max(-200, MAP_SIZE - (this.canvas.width / this.zoom) + 200);
    const maxY = Math.max(-200, MAP_SIZE - (this.canvas.height / this.zoom) + 200);
    this.camera.x = Math.max(-200, Math.min(maxX, this.camera.x));
    this.camera.y = Math.max(-200, Math.min(maxY, this.camera.y));
  }

  getBuildingAt(gx: number, gy: number): Building | null {
    return this.buildings.find(b => b.gridX === gx && b.gridY === gy) || null;
  }

  draw() {
    if (!this.ctx) return;
    const now = performance.now();
    
    // Smooth Shake
    const shakeX = (Math.random() - 0.5) * this.cameraShake;
    const shakeY = (Math.random() - 0.5) * this.cameraShake;

    // Fill background
    this.ctx.fillStyle = '#050805'; // Dark jungle floor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);
    
    // Draw Grid (optimized view)
    const margin = 2;
    const startX = Math.floor(this.camera.x / TILE_SIZE) - margin;
    const startY = Math.floor(this.camera.y / TILE_SIZE) - margin;
    const endX = Math.floor((this.camera.x + this.canvas.width / this.zoom) / TILE_SIZE) + margin;
    const endY = Math.floor((this.camera.y + this.canvas.height / this.zoom) / TILE_SIZE) + margin;

    for (let y = Math.max(0, startY); y < Math.min(GRID_SIZE, endY); y++) {
      for (let x = Math.max(0, startX); x < Math.min(GRID_SIZE, endX); x++) {
        const wx = x * TILE_SIZE;
        const wy = y * TILE_SIZE;
        const tile = this.grid[y][x];
        
        // Find if tile belongs to a base (Optimized with baseMap)
        const baseId = this.baseMap[y][x];
        const owner = baseId ? [this.player, ...this.aiWardens].find(w => w.claimedBaseId === baseId) : null;

        if (tile === TileType.TREE) {
          this.ctx.fillStyle = '#0a1a0a';
          this.ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
          
          this.ctx.fillStyle = '#061006';
          this.drawTree(wx + TILE_SIZE/2, wy + TILE_SIZE/2, TILE_SIZE * 0.9);
        } else if (tile === TileType.STONE) {
          this.ctx.fillStyle = '#334155'; // Dark blue-grey
          this.ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
          this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          this.ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);
          
          // Rubble
          this.ctx.fillStyle = '#1e293b';
          const seed = (x * 7 + y * 13) % 100;
          if (seed > 50) {
             this.ctx.beginPath();
             this.ctx.arc(wx + 20, wy + 20, 3, 0, Math.PI*2);
             this.ctx.arc(wx + 45, wy + 40, 2, 0, Math.PI*2);
             this.ctx.fill();
          }
        } else {
          // Normal Clearing or Base Tile
          if (baseId) {
            this.ctx.fillStyle = owner ? (owner === this.player ? '#2a4a2a' : '#2a2a4a') : '#1a2a1a';
            this.ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
            
            // Draw Sacred Ground Marker (+)
            this.ctx.strokeStyle = owner ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(wx + TILE_SIZE/2, wy + TILE_SIZE/4);
            this.ctx.lineTo(wx + TILE_SIZE/2, wy + 3*TILE_SIZE/4);
            this.ctx.moveTo(wx + TILE_SIZE/4, wy + TILE_SIZE/2);
            this.ctx.lineTo(wx + 3*TILE_SIZE/4, wy + TILE_SIZE/2);
            this.ctx.stroke();

            this.ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            this.ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);
          } else {
            this.ctx.fillStyle = '#2c4a2c';
            this.ctx.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            this.ctx.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    // Highlight Selected Tile & Range
    if (this._selectedTile) {
      const selectedBuilding = this.getBuildingAt(this._selectedTile.x, this._selectedTile.y);
      
      // Range Visualization for Towers
      if (selectedBuilding) {
        const stats = BUILDINGS[selectedBuilding.type];
        if (stats.range) {
          const rangePx = stats.range * TILE_SIZE;
          const rangeBonus = 1 + (selectedBuilding.owner.upgrades?.agility || 0) * 0.15;
          const bRangeUpgrade = (selectedBuilding.upgrades?.offense || 0);
          const finalRange = rangePx * (1 + bRangeUpgrade * 0.2) * rangeBonus;

          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.setLineDash([10, 5]);
          this.ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
          this.ctx.lineWidth = 2;
          this.ctx.arc(selectedBuilding.pos.x, selectedBuilding.pos.y, finalRange, 0, Math.PI * 2);
          this.ctx.stroke();

          // Fill with soft pulse
          const pulse = 0.1 + Math.sin(now * 0.003) * 0.05;
          this.ctx.fillStyle = `rgba(74, 222, 128, ${pulse})`;
          this.ctx.fill();
          this.ctx.restore();
        }
      }

      this.ctx.strokeStyle = '#4ade80';
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(this._selectedTile.x * TILE_SIZE, this._selectedTile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Base Glows
    BASES.forEach(base => {
      const isPlayerBase = this.player.claimedBaseId === base.id;
      const centerX = base.centerX * TILE_SIZE + TILE_SIZE/2;
      const centerY = base.centerY * TILE_SIZE + TILE_SIZE/2;
      const radius = 600;
      const grad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      grad.addColorStop(0, isPlayerBase ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'transparent');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // Demon Altar
    if (!this.prepPhase) {
      const altarX = MAP_SIZE / 2;
      const altarY = MAP_SIZE / 2;
      
      this.ctx.save();
      this.ctx.translate(altarX, altarY);
      
      // Healing Aura
      const auraPulse = 0.8 + Math.sin(now * 0.002) * 0.2;
      const aura = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
      aura.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      aura.addColorStop(1, 'transparent');
      this.ctx.fillStyle = aura;
      this.ctx.scale(auraPulse, auraPulse);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 200, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.setTransform(this.zoom, 0, 0, this.zoom, (-this.camera.x + shakeX) * this.zoom, (-this.camera.y + shakeY) * this.zoom);
      this.ctx.translate(altarX, altarY);

      // Structure
      this.ctx.fillStyle = '#0f172a';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#ef4444';
      
      this.ctx.beginPath();
      this.ctx.moveTo(-50, 50);
      this.ctx.lineTo(50, 50);
      this.ctx.lineTo(30, -50);
      this.ctx.lineTo(-30, -50);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Floating Crystal
      const float = Math.sin(now * 0.004) * 15;
      this.ctx.fillStyle = '#ef4444';
      this.ctx.shadowBlur = 25;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -90 + float);
      this.ctx.lineTo(25, -60 + float);
      this.ctx.lineTo(0, -30 + float);
      this.ctx.lineTo(-25, -60 + float);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.restore();
    }

    // Demon Corruption Trail
    if (this.demon) {
      this.demon.corruptionTrail.forEach((p, i) => {
        const alpha = i / this.demon!.corruptionTrail.length;
        this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.15})`;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 45 * alpha, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    // Buildings
    this.buildings.forEach(b => {
      const stats = BUILDINGS[b.type];
      this.ctx.save();
      this.ctx.translate(b.pos.x, b.pos.y);
      b.tilt += b.tiltSpeed;
      const pulse = 1 + Math.sin(b.tilt) * 0.03;
      this.ctx.scale(pulse, pulse);
      this.drawBuildingShape(0, 0, TILE_SIZE * 0.85, stats, b);
      this.ctx.restore();
      
      // HP Bar
      this.ctx.fillStyle = '#300';
      this.ctx.fillRect(b.pos.x - 20, b.pos.y - 45, 40, 5);
      this.ctx.fillStyle = '#4ade80';
      this.ctx.fillRect(b.pos.x - 20, b.pos.y - 45, 40 * (b.hp / b.maxHp), 5);

      // Income Display (Persistent)
      const woodRates: Record<string, number> = {
        [BuildingType.LUMBER_MILL]: 4, [BuildingType.LUMBER_YARD]: 14, [BuildingType.LUMBER_FACTORY]: 32,
        [BuildingType.LUMBER_CORPORATION]: 75, [BuildingType.LUMBER_EMPIRE]: 220
      };
      const goldRates: Record<string, number> = {
        [BuildingType.GOLD_MINE]: 2, [BuildingType.ENCHANTED_MINE]: 8, [BuildingType.DIVINE_MINE]: 24,
        [BuildingType.FORBIDDEN_EXCAVATION]: 60, [BuildingType.ETERNAL_TREASURY]: 240
      };
      
      const rate = woodRates[b.type] || goldRates[b.type];
      if (rate) {
        this.ctx.font = 'bold 14px Inter';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = 'black';
        this.ctx.fillStyle = woodRates[b.type] ? '#4ade80' : '#fbbf24';
        this.ctx.textAlign = 'center';
        // Add a floating pulse
        const hover = Math.sin(now * 0.005) * 3;
        this.ctx.fillText(`+${rate}/s`, b.pos.x, b.pos.y - 65 + hover);
        this.ctx.shadowBlur = 0;
      }

      // Upgrade indicators (Visual uniqueness)
      const maxUp = Math.max(b.upgrades.offense, b.upgrades.agility, b.upgrades.defense);
      if (maxUp > 0) {
        this.ctx.save();
        this.ctx.translate(b.pos.x, b.pos.y);
        
        // Aura based on level
        this.ctx.beginPath();
        this.ctx.setLineDash([]);
        const tierColor = b.upgrades.offense >= maxUp ? '239, 68, 68' : // Red
                         b.upgrades.agility >= maxUp ? '59, 130, 246' : // Blue
                         b.upgrades.economy >= maxUp ? '251, 191, 36' : // Gold
                                                       '16, 185, 129'; // Emerald
        
        this.ctx.strokeStyle = `rgba(${tierColor}, ${0.1 + maxUp * 0.1})`;
        this.ctx.lineWidth = 1 + maxUp;
        this.ctx.arc(0, 0, TILE_SIZE * 0.45 + maxUp * 2, 0, Math.PI * 2);
        this.ctx.stroke();

        if (maxUp > 3) {
          this.ctx.shadowBlur = 10 + maxUp * 2;
          this.ctx.shadowColor = `rgb(${tierColor})`;
          this.ctx.strokeStyle = `rgba(${tierColor}, 0.8)`;
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        }

        // Level pips
        const drawShapePip = (val: number, type: 'square' | 'triangle' | 'pentagon' | 'circle', color: string, offsetY: number) => {
          for (let i = 0; i < val; i++) {
            this.ctx.fillStyle = color;
            const px = -12 + i * 7;
            const py = offsetY;
            const size = 3;
            
            this.ctx.beginPath();
            if (type === 'square') {
               this.ctx.rect(px - size, py - size, size * 2, size * 2);
            } else if (type === 'triangle') {
               this.ctx.moveTo(px, py - size);
               this.ctx.lineTo(px + size, py + size);
               this.ctx.lineTo(px - size, py + size);
            } else if (type === 'pentagon') {
               for (let j = 0; j < 5; j++) {
                 const a = (j * Math.PI * 2) / 5 - Math.PI / 2;
                 this.ctx.lineTo(px + Math.cos(a) * size, py + Math.sin(a) * size);
               }
            } else {
               this.ctx.arc(px, py, size, 0, Math.PI * 2);
            }
            this.ctx.fill();
          }
        };

        if (b.upgrades.offense > 0) drawShapePip(Math.min(5, b.upgrades.offense), 'pentagon', '#f87171', 35);
        if (b.upgrades.agility > 0) drawShapePip(Math.min(5, b.upgrades.agility), 'triangle', '#60a5fa', 39);
        if (b.upgrades.range > 0) drawShapePip(Math.min(5, b.upgrades.range), 'circle', '#a855f7', 43);
        if (b.upgrades.defense > 0) drawShapePip(Math.min(5, b.upgrades.defense), 'square', '#4ade80', 47);
        if (b.upgrades.economy > 0) drawShapePip(Math.min(5, b.upgrades.economy), 'circle', '#fbbf24', 51);

        this.ctx.restore();
      }
    });

    // Wardens
    [...this.aiWardens, this.player].forEach(w => {
      if (w.isDead) return;
      const hitFlash = now - w.lastHitTime < 150;
      this.ctx.fillStyle = hitFlash ? '#ffffff' : (w === this.player ? '#4ade80' : '#3b82f6');
      this.ctx.beginPath();
      this.ctx.arc(w.pos.x, w.pos.y, w.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      if (w.isLumbering) {
        // Feature removed, but keeping flag in class for now to avoid refactoring every use
      }
    });

    // Demon
    if (this.demon && !this.demon.isDead) {
      const hitFlash = now - this.demon.lastHitTime < 150;
      this.ctx.fillStyle = hitFlash ? '#ffffff' : '#ef4444';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#f00';
      this.ctx.beginPath();
      this.ctx.arc(this.demon.pos.x, this.demon.pos.y, this.demon.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Eyes
      this.ctx.fillStyle = 'black';
      this.ctx.beginPath();
      this.ctx.arc(this.demon.pos.x - 12, this.demon.pos.y - 10, 6, 0, Math.PI * 2);
      this.ctx.arc(this.demon.pos.x + 12, this.demon.pos.y - 10, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = 'red';
      this.ctx.beginPath();
      this.ctx.arc(this.demon.pos.x - 12, this.demon.pos.y - 10, 2, 0, Math.PI * 2);
      this.ctx.arc(this.demon.pos.x + 12, this.demon.pos.y - 10, 2, 0, Math.PI * 2);
      this.ctx.fill();

      // HP Bar
      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(this.demon.pos.x - 60, this.demon.pos.y - 90, 120, 12);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fillRect(this.demon.pos.x - 60, this.demon.pos.y - 90, 120 * (this.demon.hp / this.demon.maxHp), 12);
    }

    // Lesser Demons
    this.lesserDemons.forEach(ld => {
      this.ctx.fillStyle = '#f97316';
      this.ctx.beginPath();
      this.ctx.arc(ld.pos.x, ld.pos.y, ld.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Projectiles
    this.projectiles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = p.isBomb ? 25 : 15;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    });

    // Fireflies
    this.fireflies.forEach(f => {
      f.phase += f.speed;
      const ox = Math.sin(f.phase) * 30;
      const oy = Math.cos(f.phase * 0.8) * 30;
      const alpha = 0.2 + Math.sin(f.phase) * 0.2;
      this.ctx.fillStyle = `rgba(200, 255, 100, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(f.x + ox, f.y + oy, 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Flying Texts
    this.flyingTexts.forEach(t => {
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = t.life;
      this.ctx.font = `bold ${14 + (1 - t.life) * 10}px Inter`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.globalAlpha = 1.0;
    });

    this.ctx.restore();

    // Atmosphere
    this.drawAtmosphere();
    
    this.ctx.restore();

    // Off-screen Demon Indicator
    if (this.demon && !this.demon.isDead) {
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      
      const demonWorldInViewX = (this.demon.pos.x - this.camera.x) * this.zoom;
      const demonWorldInViewY = (this.demon.pos.y - this.camera.y) * this.zoom;
      
      const margin = 40;
      if (demonWorldInViewX < 0 || demonWorldInViewX > this.canvas.width || 
          demonWorldInViewY < 0 || demonWorldInViewY > this.canvas.height) {
        
        const dir = new Vector2(demonWorldInViewX - centerX, demonWorldInViewY - centerY).normalize();
        
        let edgeX = centerX + dir.x * 5000; // Far out
        let edgeY = centerY + dir.y * 5000;
        
        // Intersect with screen bounds
        const boundsLeft = margin;
        const boundsRight = this.canvas.width - margin;
        const boundsTop = margin;
        const boundsBottom = this.canvas.height - margin;
        
        if (edgeX < boundsLeft) {
          edgeY = centerY + (boundsLeft - centerX) * (dir.y / dir.x);
          edgeX = boundsLeft;
        } else if (edgeX > boundsRight) {
          edgeY = centerY + (boundsRight - centerX) * (dir.y / dir.x);
          edgeX = boundsRight;
        }
        
        if (edgeY < boundsTop) {
          edgeX = centerX + (boundsTop - centerY) * (dir.x / dir.y);
          edgeY = boundsTop;
        } else if (edgeY > boundsBottom) {
          edgeX = centerX + (boundsBottom - centerY) * (dir.x / dir.y);
          edgeY = boundsBottom;
        }
        
        // Clamp again just in case
        edgeX = Math.max(boundsLeft, Math.min(boundsRight, edgeX));
        edgeY = Math.max(boundsTop, Math.min(boundsBottom, edgeY));

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#f00';
        this.ctx.fillStyle = '#ef4444';
        
        // Circular background
        this.ctx.beginPath();
        this.ctx.arc(edgeX, edgeY, 18, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
        
        // Skull Icon
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('💀', edgeX, edgeY);

        // Arrow pointing towards the Demon
        this.ctx.save();
        this.ctx.translate(edgeX, edgeY);
        this.ctx.rotate(Math.atan2(dir.y, dir.x));
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.moveTo(28, 0);
        this.ctx.lineTo(20, -10);
        this.ctx.lineTo(20, 10);
        this.ctx.fill();
        this.ctx.restore();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`LVL ${this.demon.level}`, edgeX, edgeY - 25);
      }
    }
  }

  drawTree(x: number, y: number, size: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2);
    this.ctx.lineTo(x - size/2, y + size/2);
    this.ctx.lineTo(x + size/2, y + size/2);
    this.ctx.fill();
  }

  drawBuildingShape(x: number, y: number, size: number, stats: any, b?: Building) {
    const color = stats.color;
    const s = size / 2;
    
    this.ctx.fillStyle = color;

    // Unique Visual Details
    if (stats.label.includes('Archer')) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for(let i=0; i<4; i++) {
           this.ctx.fillRect(x - s + (i * size/4), y - s, size/8, size/4);
        }
    }
    
    if (stats.label.includes('Supply')) {
        const now = performance.now();
        const float = Math.sin(now * 0.005) * 6;
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.beginPath();
        this.ctx.arc(x, y - s - 10 + float, 5, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y - s - 10 + float);
        this.ctx.stroke();
    }

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    switch (stats.shape) {
      case 'rectangle':
        this.ctx.rect(x - s, y - s, size, size);
        break;
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI * 2) / 6;
          this.ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        break;
      case 'tower':
        this.ctx.rect(x - s, y - s, size, size);
        this.ctx.rect(x - s + 4, y - s - 10, size/3, 10);
        this.ctx.rect(x + s - 4 - size/3, y - s - 10, size/3, 10);
        break;
      case 'diamond':
        this.ctx.moveTo(x, y - s);
        this.ctx.lineTo(x + s, y);
        this.ctx.lineTo(x, y + s);
        this.ctx.lineTo(x - s, y);
        break;
      case 'trapezoid':
        this.ctx.moveTo(x - s/2, y - s);
        this.ctx.lineTo(x + s/2, y - s);
        this.ctx.lineTo(x + s, y + s);
        this.ctx.lineTo(x - s, y + s);
        break;
      case 'octagon':
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
          this.ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI * 2) / 10 - Math.PI / 2;
          const r = i % 2 === 0 ? s : s / 2;
          this.ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        break;
    }
    this.ctx.closePath();
    this.ctx.fill();
    
    // Details based on building type
    this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    if (stats.glow) {
       this.ctx.shadowBlur = 15;
       this.ctx.shadowColor = stats.glow;
       this.ctx.stroke();
       this.ctx.shadowBlur = 0;
    }

    // Label Icon
    if (stats.icon) {
      this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      this.ctx.font = '20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(stats.icon, x, y);
    }
  }

  drawAtmosphere() {
    // Fog
    this.ctx.fillStyle = 'rgba(10, 30, 10, 0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Vignette
    const vig = this.ctx.createRadialGradient(this.canvas.width/2, this.canvas.height/2, this.canvas.width/4, this.canvas.width/2, this.canvas.height/2, this.canvas.height);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,10,0,0.8)');
    this.ctx.fillStyle = vig;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Moonlight shaft (simplified)
    const shaft = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    shaft.addColorStop(0, 'rgba(255,255,255,0.03)');
    shaft.addColorStop(0.5, 'transparent');
    shaft.addColorStop(1, 'rgba(255,255,255,0.03)');
    this.ctx.fillStyle = shaft;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  tryPlaceBuilding(gx: number, gy: number, type: BuildingType) {
    const stats = BUILDINGS[type];
    if (this.player.wood < stats.costWood || this.player.gold < stats.costGold) return false;
    
    // Check FK cost
    const fkCost = stats.fkCost || 0;
    if (this.player.forbiddenKnowledge < fkCost) return false;

    // Safety check for grid
    if (!this.grid[gy] || this.grid[gy][gx] === undefined) return false;
    if (this.grid[gy][gx] !== TileType.CLEARING) return false;

    // Direct BaseMap Ownership Check
    const baseId = this.baseMap[gy][gx];
    if (!baseId) return false;
    
    // Check if taken by someone else
    const isTaken = [this.player, ...this.aiWardens].some(w => w.claimedBaseId === baseId);
    if (isTaken && this.player.claimedBaseId !== baseId) return false;

    // AUTO-CLAIM if player builds in an unclaimed base
    if (!this.player.claimedBaseId) {
        this.player.claimedBaseId = baseId;
        const base = BASES.find(b => b.id === baseId);
        if (base) {
            // Only spawn mill if we aren't building ONE RIGHT NOW at the center
            const isAtCenter = gx === base.centerX && gy === base.centerY;
            const existing = this.getBuildingAt(base.centerX, base.centerY);
            if (!existing && !isAtCenter) {
                const shack = new Building(base.centerX, base.centerY, BuildingType.LUMBER_SHACK, this.player);
                this.buildings.push(shack);
                this.grid[base.centerY][base.centerX] = TileType.WALL;
            }
        }
    }

    if (this.player.claimedBaseId !== baseId) return false;
    
    const isOccupied = this.buildings.some(b => b.gridX === gx && b.gridY === gy);
    if (isOccupied) return false;

    // Place
    this.player.wood -= stats.costWood;
    this.player.gold -= stats.costGold;
    if (stats.fkCost) {
      this.player.forbiddenKnowledge -= stats.fkCost;
    }
    
    const b = new Building(gx, gy, type, this.player);
    this.buildings.push(b);
    this.grid[gy][gx] = TileType.WALL;
    
    console.log(`Placed building ${type} at ${gx},${gy}`);
    
    return true;
  }
}
