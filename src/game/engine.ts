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

interface FlyingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  velocity: Vector2;
}

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
  demonRespawnTimer: number = 0;
  demonScaleLevel: number = 1;
  demonTargetedWardens: string[] = []; // Track IDs of wardens attacked in current cycle
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

  flyingTexts: {x: number, y: number, text: string, color: string, life: number, vy: number, vx: number}[] = [];
  cameraShake: number = 0;
  baseFlashTimer: number = 0;
  lastClaimTime: number = 0;
  isPanning = false;
  lastMousePos: Vector2 | null = null;
  panningActive = false;
  claimedBaseId: string | null = null;

  fireflies: {x: number, y: number, phase: number, speed: number}[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initMap();
    
    // Start all at the center crossroads
    const centerX = (GRID_SIZE / 2) * TILE_SIZE;
    const centerY = (GRID_SIZE / 2) * TILE_SIZE;
    
    this.player = new Warden(centerX, centerY);
    this.player.claimedBaseId = null; // Start unclaimed
    
    // Explicitly reset panning and center camera on player
    this.panningActive = false;
    this.camera.x = this.player.pos.x - (this.canvas.width / 2) / this.zoom;
    this.camera.y = this.player.pos.y - (this.canvas.height / 2) / this.zoom;
    
    // Add AI Wardens - start them in the center too
    const strategies: AIStrategy[] = ['Archer', 'Frost', 'Fire'];
    for (let i = 0; i < 3; i++) {
      const warden = new Warden(centerX + (Math.random() - 0.5) * 150, centerY + (Math.random() - 0.5) * 150, true);
      warden.claimedBaseId = null;
      warden.strategy = strategies[i];
      this.aiWardens.push(warden);
    }
    this.initAtmosphere();
  }

  addFlyingText(x: number, y: number, text: string, color: string) {
    this.flyingTexts.push({ 
      x, y, text, color, 
      life: 1.5, 
      vy: -1.5 - Math.random() * 1.0,
      vx: (Math.random() - 0.5) * 2.0
    });
  }

  spawnDamageText(x: number, y: number, amount: number, color: string = '#ef4444') {
    this.addFlyingText(x, y - 10, `-${Math.round(amount)}`, color);
  }

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

    // 2. Carve Global Crossroads (The Main Roads) - 3 units wide (30-32)
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 30; j <= 32; j++) {
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

        // Carve entrance path: 1 block territory, then green clearing until it hits the crossroads
        const isNorth = base.centerY < 32;
        const dy = isNorth ? 1 : -1;
        const roadEdge = isNorth ? 31 : 32;

        let reachedRoad = false;
        let i = 1;
        while (!reachedRoad && i < 30) {
            const ty = base.centerY + (2 + i) * dy;
            if (ty < 0 || ty >= GRID_SIZE) break;
            
            // 1-wide entrance
            const tx = base.centerX;
            if (tx >= 0 && tx < GRID_SIZE) {
                this.grid[ty][tx] = TileType.CLEARING;
                if (i <= 4) { // First 4 blocks are buildable territory
                    this.baseMap[ty][tx] = base.id;
                    base.tiles.push({ x: tx, y: ty });
                }
            }

            // Check if we hit the horizontal road
            if (ty === roadEdge) reachedRoad = true;
            i++;
        }
    });

    // 4. The Demon's Pit (Center Crossroads) - Initially GREEN (Clearing)
    const midX = GRID_SIZE / 2;
    const midY = GRID_SIZE / 2;
    const pitRadius = 9; 
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
         const dx = x - midX + 0.5;
         const dy = y - midY + 0.5;
         if (Math.sqrt(dx*dx + dy*dy) <= pitRadius) {
            this.grid[y][x] = TileType.CLEARING; // Start as green
            this.baseMap[y][x] = null; // No building in the middle
         }
      }
    }

    // 5. Initial Light Clearing for Warden Spawn (Small green center)
    const spawnRadius = 3;
    for (let y = Math.floor(midY - spawnRadius); y <= Math.floor(midY + spawnRadius); y++) {
      for (let x = Math.floor(midX - spawnRadius); x <= Math.floor(midX + spawnRadius); x++) {
         const dx = x - (GRID_SIZE / 2 - 0.5);
         const dy = y - (GRID_SIZE / 2 - 0.5);
         if (this.grid[y] && this.grid[y][x] !== undefined && Math.sqrt(dx*dx + dy*dy) <= spawnRadius) {
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

    [3, 4, 5].forEach(milestone => {
        if (level >= milestone && !owner.fkMilestonesReached.has(milestone) && owner.forbiddenKnowledge < 3) {
            owner.forbiddenKnowledge += 1;
            owner.fkMilestonesReached.add(milestone);
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
    
    if (tile === TileType.TREE) {
       return false;
    }

    if (tile === TileType.STONE) return true;
    
    // Demon can "smash" through buildings, so they are walkable but expensive
    if (tile === TileType.WALL) {
       if (entity instanceof Demon) return true;
       const building = this.getBuildingAt(gx, gy);
       if (building && entity instanceof Warden && building.owner === entity) return true;
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
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      const key = `${current.gx},${current.gy}`;

      if (current.gx === targetGx && current.gy === targetGy) {
        const path: Vector2[] = [];
        let temp = current;
        while (temp.parent) {
          path.push(new Vector2(temp.gx * TILE_SIZE + TILE_SIZE/2, temp.gy * TILE_SIZE + TILE_SIZE/2));
          temp = temp.parent;
        }
        return path.reverse();
      }

      if (closedSet.has(key)) continue;
      closedSet.add(key);

      const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of neighbors) {
        const nx = current.gx + dx;
        const ny = current.gy + dy;
        
        if (this.isTileWalkable(nx, ny, entity)) {
          let moveCost = 1;
          if (entity instanceof Demon) {
             // Cost based on tree proximity to prefer hallways
             const neighbors = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
             for (const [dnx, dny] of neighbors) {
                const nnx = nx + dnx;
                const nny = ny + dny;
                if (nnx >= 0 && nnx < GRID_SIZE && nny >= 0 && nny < GRID_SIZE) {
                   if (this.grid[nny][nnx] === TileType.TREE) {
                      moveCost += 8; // Strongly prefer hallways
                   }
                }
             }

             // Very high cost for buildings so it only smashes if necessary
             if (this.grid[ny][nx] === TileType.WALL) {
                moveCost += 50; 
             }
          }
          const g = current.g + moveCost;
          const h = Math.abs(nx - targetGx) + Math.abs(ny - targetGy);
          openList.push({ gx: nx, gy: ny, f: g + h, g, parent: current });
        }
      }
      
      if (openList.length > 500) break; // Path too long
    }
    return null;
  }

  getBuildingAt(gx: number, gy: number): Building | null {
    return this.buildings.find(b => b.gridX === gx && b.gridY === gy) || null;
  }

  start() {
    this.gameState = GameState.PLAYING;
    this.timer = 0;
    this.lastTime = performance.now();
    this.loop();
  }

  loop() {
    const now = performance.now();
    if (this.gameState === GameState.GAMEOVER) return;
    
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    this.update(dt);
    this.updateFlyingTexts(dt);
    this.draw();
    
    requestAnimationFrame(this.loop.bind(this));
  }

  updateFlyingTexts(dt: number) {
    this.flyingTexts = this.flyingTexts.filter(t => {
      t.x += t.vx * (dt * 60);
      t.y += t.vy * (dt * 60);
      t.vy += 0.08; // Gravity
      t.life -= dt;
      return t.life > 0;
    });
  }

  update(dt: number) {
    this.timer += dt;
    
    if (this.prepPhase && this.timer > 30) { 
      this.prepPhase = false;
      this.spawnDemon();
    }

    if (this.demon) {
      if (this.demon.isDead) {
        this.demonRespawnTimer = 60;
        this.demon.pos.x = -1000; // Move far away to prevent ghost interactions before removal
        this.demon = null;
      }
    } else if (this.demonRespawnTimer > 0) {
      this.demonRespawnTimer -= dt;
      if (this.demonRespawnTimer <= 0) {
        const altar = this.buildings.find(b => b.type === BuildingType.DEMON_ALTAR);
        if (altar) {
          this.demon = new Demon(altar.pos.x, altar.pos.y);
          const scale = this.demonScaleLevel - 1;
          this.demon.maxHp += scale * 2500;
          this.demon.hp = this.demon.maxHp;
          this.demon.damage += scale * 50;
        }
      }
    }

    this.handleInput(dt);
    this.updateEntities(dt);
    this.updateCamera(dt);
    this.updateEconomy(dt);
    this.checkBaseClaiming();
    this.enforceBaseBorders();
    
    if (this.baseFlashTimer > 0) {
       this.baseFlashTimer -= dt;
    }
    
    if (this.cameraShake > 0) {
      this.cameraShake *= 0.9;
      if (this.cameraShake < 0.1) this.cameraShake = 0;
    }
  }

  spawnDemon() {
    this.demon = new Demon(MAP_SIZE / 2, MAP_SIZE / 2);
    this.cameraShake = 30;
    
    const midX = GRID_SIZE / 2;
    const midY = GRID_SIZE / 2;
    const radius = 9; 
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
         const dx = x - midX + 0.5;
         const dy = y - midY + 0.5;
         if (Math.sqrt(dx*dx + dy*dy) <= radius) {
            this.safeSetTile(y, x, TileType.STONE); // Turn ground grey (stone) around center
         }
      }
    }

    // Spawn the Demon Altar at the exact center (owner is null)
    const altar = new Building(midX - 1, midY - 1, BuildingType.DEMON_ALTAR, null);
    this.buildings.push(altar);
    this.grid[midY - 1][midX - 1] = TileType.WALL;
  }

  claimBase(w: Warden, baseId: string) {
    if (w.claimedBaseId) return;
    const base = BASES.find(b => b.id === baseId);
    if (!base) return;

    const isTaken = [this.player, ...this.aiWardens].some(other => other.claimedBaseId === baseId);
    if (isTaken) return;

    w.claimedBaseId = baseId;
    if (w.isAI) {
       w.aiTargets = {
          towers: 3 + Math.floor(Math.random() * 6), // 3-8
          walls: 1 + Math.floor(Math.random() * 4),  // 1-4
          lumber: 1 + Math.floor(Math.random() * 4), // 1-4
          mines: 1 + Math.floor(Math.random() * 2),  // 1-2
       };
    }
    if (w === this.player) {
       this.claimedBaseId = baseId;
       this.baseFlashTimer = 5; 
       this.lastClaimTime = performance.now();
       this.snapToPosition(base.centerX * TILE_SIZE + TILE_SIZE/2, base.centerY * TILE_SIZE + TILE_SIZE/2);
    }
    
    this.teleportTrespassers(baseId, w);

    const existing = this.getBuildingAt(base.centerX, base.centerY);
    if (!existing) {
      const altar = new Building(base.centerX, base.centerY, BuildingType.SACRED_ALTAR, w);
      this.buildings.push(altar);
      this.grid[base.centerY][base.centerX] = TileType.WALL;
    }

    const finalAltar = this.buildings.find(b => b.gridX === base.centerX && b.gridY === base.centerY);
    if (finalAltar) {
      w.pos.x = finalAltar.pos.x;
      w.pos.y = finalAltar.pos.y;
    }
  }

  checkBaseClaiming() {
    [this.player, ...this.aiWardens].forEach(w => {
      if (w.claimedBaseId) return;
      const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
      const baseId = this.baseMap[gy] ? this.baseMap[gy][gx] : null;
      if (baseId) {
        this.claimBase(w, baseId);
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
                const dirFromCenter = new Vector2(w.pos.x - (gx * TILE_SIZE), w.pos.y - (gy * TILE_SIZE)).normalize();
                w.pos.x += dirFromCenter.x * 10;
                w.pos.y += dirFromCenter.y * 10;
                
                const base = BASES.find(b => b.id === baseId);
                if (base && w.pos.distanceTo(new Vector2(base.centerX * TILE_SIZE, base.centerY * TILE_SIZE)) < 150) {
                    this.teleportTrespassers(baseId, owner);
                }
            }
        }
    });
  }

  drawBuildingShape(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shape: string, color: string, glow?: string) {
    ctx.save();
    if (glow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = glow;
    }
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (shape) {
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3;
          const px = x + Math.cos(ang) * size;
          const py = y + Math.sin(ang) * size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        break;
      case 'octagon':
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4;
          const px = x + Math.cos(ang) * size;
          const py = y + Math.sin(ang) * size;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        break;
      case 'diamond':
        ctx.moveTo(x, y - size * 1.2);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size * 1.2);
        ctx.lineTo(x - size, y);
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const ang = (i * Math.PI) / 5;
          const r = i % 2 === 0 ? size : size * 0.5;
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        break;
      case 'tower':
        // A tiered tower shape
        ctx.rect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - size * 0.5, y - size, size, size * 0.4);
        break;
      case 'trapezoid':
        ctx.moveTo(x - size * 0.7, y - size);
        ctx.lineTo(x + size * 0.7, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x - size, y + size);
        break;
      default: // rectangle
        ctx.rect(x - size, y - size, size * 2, size * 2);
    }

    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  damageDemon(damage: number) {
    if (this.demon && !this.demon.isDead) {
      const dmg = this.demon.takeDamage(damage);
      this.spawnDamageText(this.demon.pos.x, this.demon.pos.y, dmg, '#facc15'); // Yellow damage for demon
    }
  }

  damageAIWarden(w: Warden, damage: number) {
    const dmg = w.takeDamage(damage);
    this.spawnDamageText(w.pos.x, w.pos.y, dmg);
    // Death handling is done in the update loop via filter
  }

  damageBuilding(b: Building, damage: number) {
    const dmg = b.takeDamage(damage);
    this.spawnDamageText(b.pos.x, b.pos.y, dmg);
    if (b.hp <= 0) {
      this.grid[b.gridY][b.gridX] = TileType.CLEARING;
      if (b.type === BuildingType.SACRED_ALTAR && b.owner) b.owner.isDead = true;
    }
  }

  handleInput(dt: number) {
    const move = new Vector2(0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;

    if (this.joystick.length() > 0.1) {
      move.x = this.joystick.x;
      move.y = this.joystick.y;
    }

    this.keys.forEach(key => {
       if (key === 'Space') {
         this.snapToPlayer();
       }
    });

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
    }

    if (move.length() > 0 && !this.player.claimedBaseId) {
        this.player.targetPos = null;
        this.player.path = null;
        // this.panningActive = false;
        
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
    } else if (this.player.path && this.player.pathIndex < this.player.path.length && !this.player.claimedBaseId) {
       const target = this.player.path[this.player.pathIndex];
       const dir = new Vector2(target.x - this.player.pos.x, target.y - this.player.pos.y);
       const dist = dir.length();
       
       if (dist < 15) {
         this.player.pathIndex++;
       } else {
         const speed = this.player.speed * (dt * 60);
         const moveDir = dir.normalize();
         const nextX = this.player.pos.x + moveDir.x * speed;
         const nextY = this.player.pos.y + moveDir.y * speed;
         
         if (this.canMoveTo(nextX, nextY, this.player.radius, this.player)) {
           this.player.pos.x = nextX;
           this.player.pos.y = nextY;
         } else {
            this.player.path = null;
            this.player.targetPos = null;
         }
       }
    }

    if (this.isPanning && this.lastMousePos) {
       const dx = (this.mouse.x - this.lastMousePos.x) / this.zoom;
       const dy = (this.mouse.y - this.lastMousePos.y) / this.zoom;
       this.camera.x -= dx;
       this.camera.y -= dy;
       this.panningActive = true;
       this.lastMousePos = new Vector2(this.mouse.x, this.mouse.y);
    }
    
    this.player.pos.x = Math.max(0, Math.min(MAP_SIZE, this.player.pos.x));
    this.player.pos.y = Math.max(0, Math.min(MAP_SIZE, this.player.pos.y));
  }

  snapToPlayer() {
    this.snapToPosition(this.player.pos.x, this.player.pos.y);
  }

  snapToPosition(x: number, y: number) {
    this.panningActive = false;
    const targetX = x - (this.canvas.width / 2) / this.zoom;
    const targetY = y - (this.canvas.height / 2) / this.zoom;
    this.camera.x = targetX;
    this.camera.y = targetY;
  }

  canMoveTo(x: number, y: number, radius: number, entity?: Entity): boolean {
    const points = [
      { x: x, y: y }, 
      { x: x - radius * 0.8, y: y },
      { x: x + radius * 0.8, y: y },
      { x: x, y: y - radius * 0.8 },
      { x: x, y: y + radius * 0.8 },
      { x: x - radius * 0.6, y: y - radius * 0.6 },
      { x: x + radius * 0.6, y: y - radius * 0.6 },
      { x: x - radius * 0.6, y: y + radius * 0.6 },
      { x: x + radius * 0.6, y: y + radius * 0.6 }
    ];

    for (const p of points) {
      const { gx, gy } = worldToGrid(p.x, p.y);
      if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return false;
      const tile = this.grid[gy][gx];
      if (tile === TileType.TREE) return false;
      if (tile === TileType.WALL) {
        const building = this.getBuildingAt(gx, gy);
        if (building && entity instanceof Warden && building.owner === entity) continue;
        if (building && building.type === BuildingType.DEMON_ALTAR && entity instanceof Demon) continue;
        return false;
      }
    }
    return true;
  }

  updateEntities(dt: number) {
    const now = performance.now();
    this.projectiles = this.projectiles.filter(p => {
      const state = p.update(dt);
      if (state === 'hit') {
        if (p.isBomb) {
          const splashRange = 120;
          this.lesserDemons.forEach(ld => {
            if (ld.pos.distanceTo(p.pos) < splashRange) {
               const dmg = ld.takeDamage(p.damage * 0.6);
               this.spawnDamageText(ld.pos.x, ld.pos.y, dmg);
            }
          });
          if (this.demon && !this.demon.isDead && this.demon.pos.distanceTo(p.pos) < splashRange) {
             this.damageDemon(p.damage * 0.4);
          }
        }
        
        if (p.target instanceof Demon) {
           this.damageDemon(p.damage);
        } else if (p.target instanceof Building) {
           this.damageBuilding(p.target, p.damage);
        } else if (p.target instanceof Warden) {
           this.damageAIWarden(p.target, p.damage);
        } else {
           p.target.takeDamage(p.damage);
        }
        return false;
      }
      return state === 'moving' && !p.target.isDead;
    });

    this.aiWardens = this.aiWardens.filter(w => {
      if (w.isDead) {
        if (this.demon) this.demon.killCount++;
        this.lesserDemons.push(new LesserDemon(w.pos.x, w.pos.y)); // Spawn "red dot"
        
        // Turn towers into rubble
        this.buildings.forEach(b => {
           if (b.owner === w) {
              b.evolve(BuildingType.RUBBLE);
              b.hp = b.maxHp; // Ensure rubble stays visible
           }
        });
        
        return false;
      }
      this.updateAIWarden(w, dt);
      return true;
    });

    if (this.player.isDead && this.gameState !== GameState.GAMEOVER) {
       if (this.demon) this.demon.killCount++;
       this.lesserDemons.push(new LesserDemon(this.player.pos.x, this.player.pos.y));
       this.gameState = GameState.GAMEOVER;
    }

    const deadBuildings = this.buildings.filter(b => b.hp <= 0);
    this.buildings = this.buildings.filter(b => b.hp > 0);
    deadBuildings.forEach(b => {
      this.grid[b.gridY][b.gridX] = TileType.CLEARING;
      if (b.type === BuildingType.SACRED_ALTAR && b.owner) b.owner.isDead = true;
    });

    this.buildings.forEach(b => {
      const stats = BUILDINGS[b.type];
      const owner = b.owner;
      
      // Bonus only apply to player/AI buildings
      const globalDefenseBonus = owner ? (1 + (owner.upgrades?.defense || 0) * 0.1) : 1;
      const defenseBonus = (1 + (b.upgrades.defense || 0) * 0.2) * globalDefenseBonus;
      b.maxHp = stats.maxHp * defenseBonus;

      if (stats.range && stats.damage && now - b.lastActionTime > (stats.cooldown || 1000)) {
        let target: Entity | null = null;
        let minDist = stats.range * TILE_SIZE;

        if (this.demon && !this.demon.isDead) {
          const d = b.pos.distanceTo(this.demon.pos);
          if (d < minDist) target = this.demon;
        }
        if (!target) {
          this.lesserDemons.forEach(ld => {
            const d = b.pos.distanceTo(ld.pos);
            if (d < minDist) { target = ld; minDist = d; }
          });
        }

        if (target) {
          const offenseBonus = owner ? (1 + (owner.upgrades?.offense || 0) * 0.08) : 1;
          const damage = stats.damage! * (1 + b.upgrades.offense * 0.2) * offenseBonus;
          this.projectiles.push(new Projectile(
            b.pos.x, b.pos.y, target, damage, b.type.includes('BOMB'),
            stats.projectileColor, stats.projectileSpeed, stats.projectileSize, stats.range * TILE_SIZE
          ));
          b.lastActionTime = now;
        }
      }

      // Repair Hut Logic
      if (b.type === BuildingType.REPAIR_HUT && now - b.lastActionTime > (stats.cooldown || 1000)) {
         const repairRange = (stats.range || 5) * TILE_SIZE;
         const targets = this.buildings.filter(nb => 
            nb !== b && 
            nb.owner === b.owner && 
            nb.hp < nb.maxHp && 
            b.pos.distanceTo(nb.pos) < repairRange
         );

         if (targets.length > 0) {
            // Repair the most damaged one nearby
            targets.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
            const target = targets[0];
            target.hp = Math.min(target.maxHp, target.hp + (target.maxHp * 0.05) + 5); // Repair 5% + 5 flat
            b.lastActionTime = now;
            
            // Visual effect
            this.ctx.save();
            this.ctx.strokeStyle = '#22c55e';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(b.pos.x - this.camera.x, b.pos.y - this.camera.y);
            this.ctx.lineTo(target.pos.x - this.camera.x, target.pos.y - this.camera.y);
            this.ctx.stroke();
            this.ctx.restore();
         }
      }
    });

    if (this.demon && !this.demon.isDead) this.updateDemonAI(dt);
    this.lesserDemons = this.lesserDemons.filter(ld => {
      if (ld.isDead) return false;
      this.updateLesserDemonAI(ld, dt);
      return true;
    });
  }

  updateAIWarden(w: Warden, dt: number) {
    const now = performance.now();
    
    // 0. Target Invalidation Check
    if (w.targetPos && !w.claimedBaseId) {
       const { gx, gy } = worldToGrid(w.targetPos.x, w.targetPos.y);
       const targetBaseId = this.baseMap[gy]?.[gx];
       if (targetBaseId) {
          const isTaken = [this.player, ...this.aiWardens].some(own => own.claimedBaseId === targetBaseId && own !== w);
          if (isTaken) {
             w.targetPos = null;
             w.path = null;
          }
       }
    }

    // 1. Initial Base Claiming Strategy
    if (!w.claimedBaseId && !w.targetPos) {
       // Search for closest unclaimed base and pick one randomly from the best options to avoid stacking
       const unclaimed = BASES.filter(b => ![this.player, ...this.aiWardens].some(own => own.claimedBaseId === b.id));
       if (unclaimed.length > 0) {
          // Shuffle the unclaimed bases to ensure randomization
          const shuffled = [...unclaimed].sort(() => Math.random() - 0.5);
          const target = shuffled[0];
          
          w.targetPos = new Vector2(target.centerX * TILE_SIZE + TILE_SIZE/2, target.centerY * TILE_SIZE + TILE_SIZE/2);
          w.path = this.findPath(w.pos, w.targetPos, w);
          w.pathIndex = 0;
       }
    }

    // 2. Path Following
    if (w.path && w.pathIndex < w.path.length) {
      const target = w.path[w.pathIndex];
      const dir = new Vector2(target.x - w.pos.x, target.y - w.pos.y);
      if (dir.length() < 12) { // Increased threshold to prevent shaking
        w.pathIndex++;
      } else {
        const moveDir = dir.normalize();
        const speed = w.speed * (dt * 60);
        const nx = w.pos.x + moveDir.x * speed;
        const ny = w.pos.y + moveDir.y * speed;
        
        if (this.canMoveTo(nx, ny, w.radius, w)) {
          w.pos.x = nx;
          w.pos.y = ny;
          w.stuckTime = 0;
        } else {
          w.stuckTime += dt;
          if (w.stuckTime > 0.8) {
            w.path = this.findPath(w.pos, w.targetPos!, w);
            w.pathIndex = 0;
            w.stuckTime = 0;
          }
        }
      }
    } else if (w.targetPos) {
      if (w.pos.distanceTo(w.targetPos) < 25) { // Increased from 20
        const { gx, gy } = worldToGrid(w.pos.x, w.pos.y);
        const bid = this.baseMap[gy]?.[gx];
        if (bid) this.claimBase(w, bid);
        w.targetPos = null;
        w.path = null;
      }
    } else if (w.claimedBaseId) {
      // 3. Base Management Decisions
      if (now - w.baseDecisionTimer > 2000) {
        w.baseDecisionTimer = now;
        const base = BASES.find(b => b.id === w.claimedBaseId)!;
        const baseBuildings = this.buildings.filter(b => b.owner === w);

        const towers = baseBuildings.filter(b => b.type.includes('TOWER') || b.type.includes('SPIRE') || b.type.includes('CANNON') || b.type.includes('ARCHER') || b.type.includes('BOMB') || b.type.includes('ICE') || b.type.includes('FIRE') || b.type.includes('BLAZE') || b.type.includes('LONGBOW') || b.type.includes('SNIPER'));
        const walls = baseBuildings.filter(b => b.type.includes('WALL') || b.type.includes('BASTION') || b.type.includes('BARRIER'));
        const lumber = baseBuildings.filter(b => b.type.includes('LUMBER') || b.type.includes('LOGGING') || b.type.includes('CAMP') || b.type.includes('YARD') || b.type.includes('FACTORY') || b.type.includes('CORP') || b.type.includes('EMPIRE'));
        const mines = baseBuildings.filter(b => b.type.includes('MINE') || b.type.includes('EXCAVATION') || b.type.includes('TREASURY'));
        const entranceWall = this.getBuildingAt(base.entranceX, base.entranceY);

        // Choose what to build next based on target counts
        const possibleActions: { type: 'BUILD', bType: BuildingType }[] = [];
        
        // PRIORITY: Entrance Wall
        if (!entranceWall && w.wood >= BUILDINGS[BuildingType.WOOD_WALL].costWood) {
           this.placeBuilding(base.entranceX, base.entranceY, BuildingType.WOOD_WALL, w);
           return;
        }

        if (lumber.length < w.aiTargets.lumber) possibleActions.push({ type: 'BUILD', bType: BuildingType.LUMBER_SHACK });
        if (mines.length < w.aiTargets.mines) possibleActions.push({ type: 'BUILD', bType: BuildingType.GOLD_MINE });
        if (towers.length < w.aiTargets.towers) possibleActions.push({ type: 'BUILD', bType: BuildingType.GUARD_TOWER });
        if (walls.length < w.aiTargets.walls) possibleActions.push({ type: 'BUILD', bType: BuildingType.WOOD_WALL });

        // Shuffle possible actions
        possibleActions.sort(() => Math.random() - 0.5);

        // Try random upgrades with high priority if we have money
        const upgradable = baseBuildings.filter(b => {
           const stats = BUILDINGS[b.type];
           return stats.upgradesTo && stats.upgradesTo.length > 0;
        });

        if (upgradable.length > 0 && Math.random() < 0.6) {
           const b = upgradable[Math.floor(Math.random() * upgradable.length)];
           const upgrades = BUILDINGS[b.type].upgradesTo!;
           const nextType = upgrades[Math.floor(Math.random() * upgrades.length)];
           const targetStats = BUILDINGS[nextType];
           
           if (w.wood >= targetStats.costWood && w.gold >= (targetStats.costGold || 0)) {
              w.wood -= targetStats.costWood;
              w.gold -= targetStats.costGold || 0;
              b.evolve(nextType);
              this.addFlyingText(b.pos.x, b.pos.y - 30, "UPGRADED!", "#fbbf24");
              return;
           }
        }

        if (possibleActions.length > 0) {
           const action = possibleActions[0];
           const stats = BUILDINGS[action.bType];
           if (w.wood >= stats.costWood) {
              const empty = base.tiles.find(t => !this.getBuildingAt(t.x, t.y));
              if (empty) {
                 this.placeBuilding(empty.x, empty.y, action.bType, w);
                 return;
              }
           }
        }

        // Repair check
        const damaged = baseBuildings.find(b => b.hp < b.maxHp * 0.7);
        if (damaged && w.wood >= 10) {
           this.repairBuilding(damaged); // AI repairs for 10 wood
           return;
        }
      }
    }
  }

  updateDemonAI(dt: number) {
    if (!this.demon) return;
    const now = performance.now();
    const midPos = new Vector2(MAP_SIZE / 2, MAP_SIZE / 2);

    // 1. State Transitions
    if (this.demon.state === 'HUNT') {
      if (this.demon.hp < this.demon.maxHp * 0.25) { // 25% threshold (between 20-30%)
        this.demon.state = 'RETREAT';
        this.demon.currentTarget = null;
      }
    } else if (this.demon.state === 'RETREAT') {
      const altar = this.buildings.find(b => b.type === BuildingType.DEMON_ALTAR);
      if (altar && this.demon.pos.distanceTo(altar.pos) < 100) {
        // Healing at altar
        this.demon.hp += dt * 500; // Even faster heal
        if (this.demon.hp >= this.demon.maxHp) {
          this.demon.hp = this.demon.maxHp;
          this.demon.state = 'HUNT';
          this.demon.level++; // Explicit level up
          this.demonScaleLevel++;
          
          // Apply level-up buffs
          this.demon.maxHp += 4000;
          this.demon.hp = this.demon.maxHp;
          this.demon.damage += 85;
          this.demon.attackSpeed *= 1.08;
          this.demon.speed *= 1.05;
          
          this.addFlyingText(this.demon.pos.x, this.demon.pos.y - 40, `LEVEL UP: ${this.demon.level}`, "#facc15");
          this.addFlyingText(this.demon.pos.x, this.demon.pos.y - 70, "EVOLVED!", "#ef4444");
        }
      }
    }

    // 2. Logic Execution
    if (this.demon.state === 'RETREAT') {
      const altar = this.buildings.find(b => b.type === BuildingType.DEMON_ALTAR);
      const retreatTarget = altar ? altar.pos : midPos;
      
      const dir = new Vector2(retreatTarget.x - this.demon.pos.x, retreatTarget.y - this.demon.pos.y);
      if (dir.length() > 30) {
        // Use Pathfinding for retreat
        if (!this.demon.path || this.demon.path.length === 0 || this.demon.pathTimer <= 0) {
           this.demon.path = this.findPath(this.demon.pos, retreatTarget, this.demon);
           this.demon.pathTimer = 2.0;
           this.demon.pathIndex = 0;
        }

        if (this.demon.path && this.demon.path.length > 0) {
           const nextPoint = this.demon.path[this.demon.pathIndex];
           const moveDir = new Vector2(nextPoint.x - this.demon.pos.x, nextPoint.y - this.demon.pos.y);
           const moveDist = moveDir.length();

           if (moveDist < 20) {
              this.demon.pathIndex++;
              if (this.demon.pathIndex >= this.demon.path.length) {
                 this.demon.path = null;
              }
           }

           const speed = this.demon.speed * 1.5 * (dt * 60);
           const stepDir = moveDir.normalize();
           const nx = this.demon.pos.x + stepDir.x * speed;
           const ny = this.demon.pos.y + stepDir.y * speed;

           if (this.canMoveTo(nx, ny, this.demon.radius, this.demon)) {
              this.demon.pos.x = nx;
              this.demon.pos.y = ny;
           } else {
              // Blocked while retreating - smash buildings only
              const { gx, gy } = worldToGrid(nx, ny);
              const b = this.getBuildingAt(gx, gy);
              if (b) {
                 if (now - this.demon.lastAttackTime > 500) {
                    this.damageBuilding(b, this.demon.damage);
                    this.demon.lastAttackTime = now;
                 }
              }
              this.demon.pathTimer = 0; // Force repath
           }
        } else {
           // Direct movement fallback
           const speed = this.demon.speed * 1.5 * (dt * 60);
           const normDir = dir.normalize();
           const nx = this.demon.pos.x + normDir.x * speed;
           const ny = this.demon.pos.y + normDir.y * speed;
           if (this.canMoveTo(nx, ny, this.demon.radius, this.demon)) {
              this.demon.pos.x = nx;
              this.demon.pos.y = ny;
           }
        }
      }
    } else if (this.demon.state === 'HUNT') {
      // Improved targeting with lock
      if (!this.demon.currentTarget || (this.demon.currentTarget as any).isDead || now > this.demon.targetLockedTime) {
        // Find potential targets: Players/Wardens in a cycle
        const allWardens = [this.player, ...this.aiWardens].filter(w => !w.isDead);
        
        // Reset cycle if all wardens targeted or none left in current cycle
        const availableInCycle = allWardens.filter(w => !this.demonTargetedWardens.includes(w.id));
        
        if (availableInCycle.length === 0) {
           this.demonTargetedWardens = [];
        }
        
        const possibleWardens = availableInCycle.length > 0 ? availableInCycle : allWardens;
        
        if (possibleWardens.length > 0) {
          // Choose a random warden from the ones not yet targeted in this cycle
          const targetWarden = possibleWardens[Math.floor(Math.random() * possibleWardens.length)];
          this.demon.currentTarget = targetWarden;
          this.demonTargetedWardens.push(targetWarden.id);
          
          // Target lock for 15-20 seconds
          this.demon.targetLockedTime = now + (15000 + Math.random() * 5000);
          this.demon.path = null; 
        } else {
           const buildings = this.buildings.filter(b => b.owner && b.type !== BuildingType.DEMON_ALTAR);
           if (buildings.length > 0) {
              this.demon.currentTarget = buildings[Math.floor(Math.random() * buildings.length)];
           }
        }
      }

      if (this.demon.currentTarget) {
        const target = this.demon.currentTarget;
        const dir = new Vector2(target.pos.x - this.demon.pos.x, target.pos.y - this.demon.pos.y);
        const dist = dir.length();

        if (dist < 100) { // Increased combat range
          // Combat Range
          const attackCooldown = (this.demon.attackCooldown || 1000) / this.demon.attackSpeed;
          if (now - this.demon.lastAttackTime > attackCooldown) {
             // Second check for actual attack distance
             if (dist < 75) {
                if (target instanceof Warden) {
                   this.damageAIWarden(target, this.demon.damage);
                } else if (target instanceof Building) {
                   this.damageBuilding(target, this.demon.damage);
                } else {
                   target.takeDamage(this.demon.damage);
                }
                this.demon.lastAttackTime = now;
                this.cameraShake = 5;
                this.demon.path = null; 
             } else {
                // If in combat range but not attack range, push closer directly
                const moveDir = dir.normalize();
                const speed = this.demon.speed * (dt * 60);
                const nx = this.demon.pos.x + moveDir.x * speed;
                const ny = this.demon.pos.y + moveDir.y * speed;
                
                if (this.canMoveTo(nx, ny, this.demon.radius, this.demon)) {
                   this.demon.pos.x = nx;
                   this.demon.pos.y = ny;
                }
             }
          }
        } else {
          // Movement - Use Pathfinding
          if (!this.demon.path || this.demon.path.length === 0 || this.demon.pathTimer <= 0) {
             this.demon.path = this.findPath(this.demon.pos, target.pos, this.demon);
             this.demon.pathTimer = 3.0; // Re-path every 3 seconds
             this.demon.pathIndex = 0;
          }

          if (this.demon.path && this.demon.path.length > 0) {
             const nextPoint = this.demon.path[this.demon.pathIndex];
             const moveDir = new Vector2(nextPoint.x - this.demon.pos.x, nextPoint.y - this.demon.pos.y);
             const moveDist = moveDir.length();

             if (moveDist < 20) {
                this.demon.pathIndex++;
                if (this.demon.pathIndex >= this.demon.path.length) {
                   this.demon.path = null;
                }
             }

             const speed = this.demon.speed * (dt * 60);
             const stepDir = moveDir.normalize();
             const nx = this.demon.pos.x + stepDir.x * speed;
             const ny = this.demon.pos.y + stepDir.y * speed;

             if (this.canMoveTo(nx, ny, this.demon.radius, this.demon)) {
                this.demon.pos.x = nx;
                this.demon.pos.y = ny;
                this.demon.stuckDuration = 0;
             } else {
                // Blocked - Smash Obstacle
                this.demon.stuckDuration += dt;
                const { gx, gy } = worldToGrid(nx, ny);
                
                // If it's a building, damage it
                const b = this.getBuildingAt(gx, gy);
                if (b && b !== this.demon.currentTarget) {
                   const smashCooldown = 800 / this.demon.attackSpeed;
                   if (now - this.demon.lastAttackTime > smashCooldown) {
                      this.damageBuilding(b, this.demon.damage * 0.8);
                      this.demon.lastAttackTime = now;
                   }
                }
                
                // Repath immediately if stuck or after smashing
                if (this.demon.stuckDuration > 0.6) {
                   this.demon.pathTimer = 0;
                   this.demon.stuckDuration = 0;
                }
             }
          } else {
             // Fallback to direct movement if no path
             const directDir = dir.normalize();
             const speed = this.demon.speed * (dt * 60);
             if (this.canMoveTo(this.demon.pos.x + directDir.x * speed, this.demon.pos.y + directDir.y * speed, this.demon.radius, this.demon)) {
                this.demon.pos.x += directDir.x * speed;
                this.demon.pos.y += directDir.y * speed;
             }
          }
        }
      }
    }
  }

  updateLesserDemonAI(ld: LesserDemon, dt: number) {
     const now = performance.now();
     
     // Find closest target (Warden or Player)
     let target: Entity | null = this.player;
     let minDist = ld.pos.distanceTo(this.player.pos);
     
     this.aiWardens.forEach(w => {
        if (!w.isDead) {
           const d = ld.pos.distanceTo(w.pos);
           if (d < minDist) {
              minDist = d;
              target = w;
           }
        }
     });

     if (!target || target.isDead) return;

     const dir = new Vector2(target.pos.x - ld.pos.x, target.pos.y - ld.pos.y);
     if (dir.length() < 35) {
       if (now - ld.lastAttackTime > 1000) {
         if (target instanceof Warden) {
            this.damageAIWarden(target, ld.damage);
         } else {
            target.takeDamage(ld.damage);
         }
         ld.lastAttackTime = now;
       }
     } else {
       const move = dir.normalize();
       // Phasing move: no canMoveTo check, moves through trees/walls/etc.
       ld.pos.x += move.x * ld.speed * (dt * 60);
       ld.pos.y += move.y * ld.speed * (dt * 60);
     }
  }

  updateEconomy(dt: number) {
    this.buildings.forEach(b => {
      const stats = BUILDINGS[b.type];
      const owner = b.owner;
      if (!owner) return;

      let genW = 0;
      let genG = 0;

      if (b.type.includes('LUMBER')) genW = 2.5 * dt;
      if (b.type.includes('GOLD')) genG = 1.5 * dt;
      if (b.type === BuildingType.SACRED_ALTAR) genW = 1.0 * dt;

      owner.wood += genW;
      owner.gold += genG;
      b.accumulatedWood += genW;
      b.accumulatedGold += genG;

      b.textTimer += dt;
      if (b.textTimer > 3.0) {
        if (b.accumulatedWood >= 1) {
           this.addFlyingText(b.pos.x, b.pos.y - 20, `+${Math.floor(b.accumulatedWood)}`, '#10b981');
           b.accumulatedWood = 0;
        }
        if (b.accumulatedGold >= 1) {
           this.addFlyingText(b.pos.x, b.pos.y - 40, `+${Math.floor(b.accumulatedGold)}`, '#fbbf24');
           b.accumulatedGold = 0;
        }
        b.textTimer = 0;
      }
    });
  }

  updateCamera(dt: number) {
    // If not panning and (unclaimed OR explicit snap), follow player
    if (!this.panningActive || !this.player.claimedBaseId) {
      const targetX = this.player.pos.x - (this.canvas.width / 2) / this.zoom;
      const targetY = this.player.pos.y - (this.canvas.height / 2) / this.zoom;
      
      const lerp = this.player.claimedBaseId ? 0.1 : 0.25; // Snappier follow when roaming
      this.camera.x += (targetX - this.camera.x) * lerp;
      this.camera.y += (targetY - this.camera.y) * lerp;
    }
  }

  tryPlaceBuilding(gx: number, gy: number, type: BuildingType): boolean {
    return this.placeBuilding(gx, gy, type, this.player);
  }

  placeBuilding(gx: number, gy: number, type: BuildingType, owner: Warden): boolean {
    const stats = BUILDINGS[type];
    if (owner.wood >= stats.costWood && owner.gold >= (stats.costGold || 0)) {
      if (!this.getBuildingAt(gx, gy)) {
        const b = new Building(gx, gy, type, owner);
        this.buildings.push(b);
        owner.wood -= stats.costWood;
        owner.gold -= stats.costGold;
        this.grid[gy][gx] = TileType.WALL;
        return true;
      }
    }
    return false;
  }

  repairBuilding(b: Building) {
    if (this.player.wood >= 10) {
      this.player.wood -= 10;
      b.hp = b.maxHp;
    }
  }

  sellBuilding(b: Building) {
    const stats = BUILDINGS[b.type];
    this.player.wood += stats.costWood * 0.5;
    this.player.gold += stats.costGold * 0.5;
    b.hp = 0; // Will be cleaned up next update
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.cameraShake > 0) {
      ctx.translate(Math.random() * this.cameraShake - this.cameraShake/2, Math.random() * this.cameraShake - this.cameraShake/2);
    }
    
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    const startX = Math.floor(this.camera.x / TILE_SIZE);
    const startY = Math.floor(this.camera.y / TILE_SIZE);
    const endX = startX + Math.ceil(this.canvas.width / (TILE_SIZE * this.zoom)) + 1;
    const endY = startY + Math.ceil(this.canvas.height / (TILE_SIZE * this.zoom)) + 1;

    for (let y = Math.max(0, startY); y < Math.min(GRID_SIZE, endY); y++) {
      for (let x = Math.max(0, startX); x < Math.min(GRID_SIZE, endX); x++) {
        const tile = this.grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        
    // Darker Base Colors
    if (tile === TileType.TREE) {
        ctx.fillStyle = '#031a15'; // Deeper, darker forest
    } else if (tile === TileType.STONE) {
        ctx.fillStyle = '#111827'; // Near black stone
    } else {
        ctx.fillStyle = '#052c24'; // Muddy dark clearing
    }
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    
    // Gradient overlay for tiles
    const tileGrad = ctx.createLinearGradient(px, py, px + TILE_SIZE, py + TILE_SIZE);
    tileGrad.addColorStop(0, 'rgba(255,255,255,0.02)');
    tileGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = tileGrad;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Tree Details: Triangles (Layered for depth)
    if (tile === TileType.TREE) {
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE*0.5, py + TILE_SIZE*0.1);
        ctx.lineTo(px + TILE_SIZE*0.9, py + TILE_SIZE*0.9);
        ctx.lineTo(px + TILE_SIZE*0.1, py + TILE_SIZE*0.9);
        ctx.fill();
        
        ctx.fillStyle = '#022c22';
        ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE*0.5, py + TILE_SIZE*0.4);
        ctx.lineTo(px + TILE_SIZE*0.8, py + TILE_SIZE*0.9);
        ctx.lineTo(px + TILE_SIZE*0.2, py + TILE_SIZE*0.9);
        ctx.fill();
    }

        // DRAW TERRITORY (Base highlights)
        const baseId = this.baseMap[y][x];
        if (baseId) {
           const owner = [this.player, ...this.aiWardens].find(w => w.claimedBaseId === baseId);
           if (owner) {
              const age = (performance.now() - this.lastClaimTime) / 1000;
              const isPlayer = owner === this.player;
              
              if (isPlayer && age < 10) {
                 // Claim Glow effect
                 const glowIntensity = Math.abs(Math.sin(performance.now() * 0.005)) * ((10 - age) / 10);
                 ctx.fillStyle = `rgba(251, 191, 36, ${0.1 + glowIntensity * 0.3})`;
                 ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + glowIntensity * 0.6})`;
                 ctx.lineWidth = 3;
                 ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                 ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
              } else {
                 ctx.fillStyle = isPlayer ? 'rgba(251, 191, 36, 0.08)' : 'rgba(96, 165, 250, 0.06)';
                 ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
              }

              // Indicators for empty slots
              if (!this.getBuildingAt(x, y)) {
                 ctx.fillStyle = isPlayer ? 'rgba(251, 191, 36, 0.2)' : 'rgba(96, 165, 250, 0.15)';
                 ctx.font = 'bold 16px monospace';
                 ctx.textAlign = 'center';
                 ctx.fillText('+', px + TILE_SIZE/2, py + TILE_SIZE/2 + 6);
              }
           }
        }

        // Selected Tile Outline
        if (this._selectedTile && this._selectedTile.x === x && this._selectedTile.y === y) {
           ctx.strokeStyle = '#fff';
           ctx.lineWidth = 2;
           ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
           
           ctx.fillStyle = 'rgba(255,255,255,0.1)';
           ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    this.buildings.forEach(b => {
      const stats = BUILDINGS[b.type];
      
      // Special Rendering for Demon Altar
      if (b.type === BuildingType.DEMON_ALTAR) {
         const time = performance.now();
         const pulse = Math.sin(time * 0.003) * 8;
         const rot = time * 0.001;
         
         ctx.save();
         // Large Pulsing Outer Glow
         ctx.shadowBlur = 40 + pulse * 2;
         ctx.shadowColor = '#dc2626';
         
         // Deep Dark Base (Octagon)
         ctx.fillStyle = '#050505';
         ctx.beginPath();
         const s = TILE_SIZE * 1.2;
         for (let i = 0; i < 8; i++) {
           const ang = (i * Math.PI) / 4 + rot;
           const px = b.pos.x + Math.cos(ang) * s;
           const py = b.pos.y + Math.sin(ang) * s;
           if (i === 0) ctx.moveTo(px, py);
           else ctx.lineTo(px, py);
         }
         ctx.closePath();
         ctx.fill();
         ctx.strokeStyle = '#991b1b';
         ctx.lineWidth = 4;
         ctx.stroke();

         // Runes / Spikes
         ctx.strokeStyle = '#ef4444';
         ctx.lineWidth = 2;
         for (let i = 0; i < 16; i++) {
           const ang = (i * Math.PI) / 8 - rot * 1.5;
           const d1 = s * 0.7;
           const d2 = s * (1.1 + Math.sin(time * 0.005 + i) * 0.1);
           ctx.beginPath();
           ctx.moveTo(b.pos.x + Math.cos(ang) * d1, b.pos.y + Math.sin(ang) * d1);
           ctx.lineTo(b.pos.x + Math.cos(ang) * d2, b.pos.y + Math.sin(ang) * d2);
           ctx.stroke();
         }

         // Energy Ring
         ctx.beginPath();
         ctx.arc(b.pos.x, b.pos.y, s * 0.8 + pulse, 0, Math.PI * 2);
         ctx.strokeStyle = '#ef4444';
         ctx.lineWidth = 5;
         ctx.setLineDash([15, 10]);
         ctx.lineDashOffset = -time * 0.1;
         ctx.stroke();
         ctx.setLineDash([]);

         // Pentagram
         ctx.beginPath();
         for(let i=0; i<5; i++) {
            const ang = (i * 0.8 * Math.PI) - Math.PI/2 + rot;
            const dist = s * 0.9;
            const tx = b.pos.x + Math.cos(ang) * dist;
            const ty = b.pos.y + Math.sin(ang) * dist;
            if (i === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
         }
         ctx.closePath();
         ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + pulse*0.04})`;
         ctx.lineWidth = 4;
         ctx.stroke();
         
         // Rising particles (emulated with small arcs)
         for (let i=0; i<3; i++) {
            const pX = b.pos.x + Math.sin((time + i*1000) * 0.005) * 15;
            const pY = b.pos.y - ((time/10 + i*20) % 40);
            const alpha = 1 - (((time/10 + i*20) % 40) / 40);
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(pX, pY, 2, 0, Math.PI * 2);
            ctx.fill();
         }

         ctx.restore();
         
         // HP Bar for altar
         if (b.hp < b.maxHp) {
            ctx.fillStyle = '#111';
            ctx.fillRect(b.pos.x - 50, b.pos.y - 85, 100, 8);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(b.pos.x - 50, b.pos.y - 85, 100 * (b.hp / b.maxHp), 8);
         }
         return; 
      }

      ctx.fillStyle = stats.color;
      this.drawBuildingShape(ctx, b.pos.x, b.pos.y, TILE_SIZE * 0.45, stats.shape, stats.color, stats.glow);

      // Icon for buildings
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(stats.icon || '', b.pos.x, b.pos.y + 8);
      
      // HP Bar
      if (b.hp < b.maxHp) {
        ctx.fillStyle = '#111';
        ctx.fillRect(b.pos.x - 20, b.pos.y - 30, 40, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(b.pos.x - 20, b.pos.y - 30, 40 * (b.hp / b.maxHp), 4);
      }
    });

    [this.player, ...this.aiWardens].forEach(w => {
      if (w.isDead) return;
      ctx.fillStyle = w === this.player ? '#fbbf24' : '#60a5fa';
      ctx.shadowBlur = 10;
      ctx.shadowColor = w === this.player ? '#fbbf24' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(w.pos.x, w.pos.y, w.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (this.demon && !this.demon.isDead) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(this.demon.pos.x, this.demon.pos.y, this.demon.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Demon HP
      ctx.fillStyle = '#111';
      ctx.fillRect(this.demon.pos.x - 50, this.demon.pos.y - 65, 100, 8);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(this.demon.pos.x - 50, this.demon.pos.y - 65, 100 * (this.demon.hp / this.demon.maxHp), 8);
    }

    this.lesserDemons.forEach(ld => {
      ctx.fillStyle = '#ef4444'; // Bright Red
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(ld.pos.x, ld.pos.y, 6, 0, Math.PI * 2); // Small "dot" size
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    this.projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    this.flyingTexts.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.font = 'bold 20px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    });

    ctx.restore();

    // DRAW UI TIMER
    if (this.demonRespawnTimer > 0) {
       ctx.save();
       const bw = 320;
       const bh = 50;
       const uiY = 180; // Moved down to avoid being obscured
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(this.canvas.width/2 - bw/2, uiY, bw, bh);
       ctx.strokeStyle = '#ef4444';
       ctx.lineWidth = 2;
       ctx.strokeRect(this.canvas.width/2 - bw/2, uiY, bw, bh);
       
       ctx.fillStyle = '#ef4444';
       ctx.font = 'bold 22px "JetBrains Mono"';
       ctx.textAlign = 'center';
       ctx.fillText(`DEMON RESPAWNING: ${Math.ceil(this.demonRespawnTimer)}s`, this.canvas.width/2, uiY + 33);
       ctx.restore();
    }

    // VIGNETTE EFFECT
    const grad = ctx.createRadialGradient(
      this.canvas.width/2, this.canvas.height/2, 0,
      this.canvas.width/2, this.canvas.height/2, Math.max(this.canvas.width, this.canvas.height) * 0.8
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

