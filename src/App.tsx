import React, { useEffect, useRef, useState, KeyboardEvent, MouseEvent, TouchEvent, WheelEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Home, 
  HelpCircle, 
  Trophy, 
  Axe, 
  Coins, 
  Heart,
  Hammer,
  Shield,
  ArrowUp,
  Zap,
  TowerControl as Tower,
  Skull,
  LogOut,
  Wrench,
  Lock
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { GameState, BuildingType, BUILDINGS, TILE_SIZE, BASES } from './game/constants';
import { Vector2 } from './game/utils';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [resources, setResources] = useState({ 
    wood: 0, 
    gold: 0, 
    hp: 100, 
    isLumbering: false,
    forbiddenKnowledge: 0 
  });
  const [hasClaimedBase, setHasClaimedBase] = useState(false);
  const lastClaimedId = useRef<string | null>(null);

  // Mobile Interaction State
  const [lastTouches, setLastTouches] = useState<{ x: number, y: number, id: number }[]>([]);
  const [touchDistMoved, setTouchDistMoved] = useState(0);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const [joystickOrigin, setJoystickOrigin] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    if (hasClaimedBase) {
      const timer = setTimeout(() => setHasClaimedBase(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [hasClaimedBase]);
  const [gameInfo, setGameInfo] = useState({ demonLevel: 1, timer: 0 });
  const [selectedTile, setSelectedTile] = useState<{ x: number, y: number } | null>(null);
  
  const [isPlayerInView, setIsPlayerInView] = useState(true);
  const [panningActive, setPanningActive] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    const handleKeyDownWindow = (e: any) => {
      engineRef.current?.keys.add(e.code);
      
      // Dev Cheat: NumpadAdd or Plus key
      if (e.code === 'NumpadAdd' || e.key === '+' || (e.key === '=' && e.shiftKey)) {
        if (engineRef.current) {
          engineRef.current.player.wood += 100;
          engineRef.current.player.gold += 100;
          engineRef.current.addFlyingText(engineRef.current.player.pos.x, engineRef.current.player.pos.y, "CHEAT: +100", "#4ade80");
        }
      }
    };
    const handleKeyUpWindow = (e: any) => engineRef.current?.keys.delete(e.code);
    
    const handleMouseDown = (e: any) => {
        if (!engineRef.current) return;
        engineRef.current.isPanning = true;
        engineRef.current.lastMousePos = { x: e.clientX, y: e.clientY } as any;
    };
    const handleMouseMove = (e: any) => {
        if (!engineRef.current) return;
        engineRef.current.mouse.x = e.clientX;
        engineRef.current.mouse.y = e.clientY;
    };
    const handleMouseUp = () => {
        if (!engineRef.current) return;
        engineRef.current.isPanning = false;
        engineRef.current.lastMousePos = null;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDownWindow);
    window.addEventListener('keyup', handleKeyUpWindow);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    handleResize();
    
    // Update UI state from engine
    const updateInterval = setInterval(() => {
      if (engineRef.current) {
        setResources({
          wood: Math.floor(engineRef.current.player.wood),
          gold: Math.floor(engineRef.current.player.gold),
          hp: Math.floor(engineRef.current.player.hp),
          isLumbering: engineRef.current.player.isLumbering,
          forbiddenKnowledge: engineRef.current.player.forbiddenKnowledge
        });
          if (engineRef.current.player.claimedBaseId && engineRef.current.player.claimedBaseId !== lastClaimedId.current) {
            setHasClaimedBase(true);
            lastClaimedId.current = engineRef.current.player.claimedBaseId;
            // Set modalClosedTime to prevent immediate selection when teleported
            modalClosedTime.current = performance.now();
            if (engineRef.current) engineRef.current.lastClaimTime = performance.now();
          }
        setGameInfo({
          demonLevel: engineRef.current.demon?.level || 1,
          timer: Math.floor(engineRef.current.timer),
        });

        // Check if player in view (with 50px tolerance)
        const p = engineRef.current.player.pos;
        const c = engineRef.current.camera;
        const pad = 50;
        const w = window.innerWidth / engineRef.current.zoom;
        const h = window.innerHeight / engineRef.current.zoom;
        const inView = p.x >= c.x - pad && p.x <= c.x + w + pad && p.y >= c.y - pad && p.y <= c.y + h + pad;
        setIsPlayerInView(inView);
        setPanningActive(engineRef.current.panningActive);

        if (engineRef.current.player.isDead) {
          setGameState(GameState.GAMEOVER);
          engineRef.current.gameState = GameState.GAMEOVER;
        }

        // Camera follow logic in UI loop: ONLY reset if explicitly requested or outside base
        // if (engineRef.current.keys.size > 0 || engineRef.current.joystick.length() > 0.1) {
        //    engineRef.current.panningActive = false;
        // }
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDownWindow);
      window.removeEventListener('keyup', handleKeyUpWindow);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      clearInterval(updateInterval);
      engineRef.current = null;
    };
  }, []);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    engineRef.current?.start();
  };

  const lastTouchTime = useRef(0);
  const modalClosedTime = useRef(0);
  const handleCanvasClick = (e: MouseEvent) => {
    if (!engineRef.current) return;
    const now = performance.now();
    if (now - lastTouchTime.current < 400) return;
    if (now - modalClosedTime.current < 500) return;
    
    // Prevent shop opening for 1s after claiming base
    if (engineRef.current.lastClaimTime && now - engineRef.current.lastClaimTime < 1000) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const zoom = engineRef.current.zoom;
    const x = (e.clientX - rect.left) / zoom + engineRef.current.camera.x;
    const y = (e.clientY - rect.top) / zoom + engineRef.current.camera.y;
    
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    
    // Only open shop if clicking empty tile in OWN base OR if there's an existing building to manage
    const baseId = engineRef.current.baseMap[gy]?.[gx];
    const clickedBuilding = engineRef.current.getBuildingAt(gx, gy);
    const isOwnBase = baseId && engineRef.current.player.claimedBaseId === baseId;
    
    if (clickedBuilding || isOwnBase || (baseId && !engineRef.current.player.claimedBaseId)) {
      // Trigger claim if base is unclaimed
      if (baseId && !engineRef.current.player.claimedBaseId) {
        engineRef.current.claimBase(engineRef.current.player, baseId);
      }

      setSelectedTile({ x: gx, y: gy });
      engineRef.current._selectedTile = { x: gx, y: gy };
      
      // RTS Camera Snap: If clicking within your OWN base, snap to that location
      if (isOwnBase && engineRef.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        engineRef.current.camera.x = (gx * TILE_SIZE + TILE_SIZE/2) - (rect.width / 2) / zoom;
        engineRef.current.camera.y = (gy * TILE_SIZE + TILE_SIZE/2) - (rect.height / 2) / zoom;
        engineRef.current.panningActive = true; 
      }
    } else {
      setSelectedTile(null);
      engineRef.current._selectedTile = null;
    }

    // Toggle selection if clicking a building
    if (clickedBuilding) {
      if (clickedBuilding.owner === engineRef.current.player) {
         // Auto-snap if needed, but don't toggle isLumbering here as it should be auto-enforced
         if (engineRef.current.player.isLumbering) {
            engineRef.current.player.pos.x = clickedBuilding.pos.x;
            engineRef.current.player.pos.y = clickedBuilding.pos.y;
         }
      }
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    // Check if we touched something that should block interaction (like HUD)
    const target = e.target as HTMLElement;
    if (target.closest('.pointer-events-auto')) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setLastTouches([{ x: touch.clientX, y: touch.clientY, id: touch.identifier }]);
      setTouchDistMoved(0);
      setLastPinchDist(null);

      // JOYSTICK ANYWHERE: If no base claimed, this is the joystick anchor
      if (engineRef.current && !engineRef.current.player.claimedBaseId) {
        setJoystickOrigin({ x: touch.clientX, y: touch.clientY });
      } else {
        setJoystickOrigin(null);
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
      setLastPinchDist(dist);
      setLastTouches([
        { x: t1.clientX, y: t1.clientY, id: t1.identifier },
        { x: t2.clientX, y: t2.clientY, id: t2.identifier }
      ]);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!engineRef.current) return;

    if (e.touches.length === 1 && lastTouches.length === 1) {
      const touch = e.touches[0];
      const last = lastTouches[0];
      
      const distMovement = Math.sqrt(Math.pow(touch.clientX - last.x, 2) + Math.pow(touch.clientY - last.y, 2));
      setTouchDistMoved(prev => prev + distMovement);
      
      // JOYSTICK LOGIC: If we have an origin and no base, move the player
      if (joystickOrigin && engineRef.current && !engineRef.current.player.claimedBaseId) {
         const dx = touch.clientX - joystickOrigin.x;
         const dy = touch.clientY - joystickOrigin.y;
         const dist = Math.sqrt(dx*dx + dy*dy);
         const maxRadius = 60;
         
         if (dist > 10) {
            const pull = Math.min(dist, maxRadius) / maxRadius;
            engineRef.current.joystick.x = (dx / dist) * pull;
            engineRef.current.joystick.y = (dy / dist) * pull;
            engineRef.current.panningActive = true; 
         } else {
            engineRef.current.joystick.x = 0;
            engineRef.current.joystick.y = 0;
         }
      } else if (distMovement > 5 || engineRef.current?.panningActive) {
        // Pan camera only if moved enough to distinguish from a tap
        const dx = (touch.clientX - last.x) / engineRef.current!.zoom;
        const dy = (touch.clientY - last.y) / engineRef.current!.zoom;
        
        engineRef.current!.camera.x -= dx;
        engineRef.current!.camera.y -= dy;
        engineRef.current!.panningActive = true;
        
        setLastTouches([{ x: touch.clientX, y: touch.clientY, id: touch.identifier }]);
      }
    } else if (e.touches.length === 2 && lastPinchDist !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
      
      // Zoom
      const zoomFactor = dist / lastPinchDist;
      const newZoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * zoomFactor));
      
      engineRef.current.zoom = newZoom;
      setLastPinchDist(dist);
      setLastTouches([
        { x: t1.clientX, y: t1.clientY, id: t1.identifier },
        { x: t2.clientX, y: t2.clientY, id: t2.identifier }
      ]);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    lastTouchTime.current = performance.now();
    if (engineRef.current) {
       engineRef.current.joystick.x = 0;
       engineRef.current.joystick.y = 0;
    }
    setJoystickOrigin(null);

    if (e.touches.length === 0) {
      // Logic for selection on quick tap - check total distance moved during this touch
      if (lastTouches.length === 1 && touchDistMoved < 15) {
          const rect = canvasRef.current!.getBoundingClientRect();
          const zoom = engineRef.current?.zoom || 1;
          const touch = lastTouches[0];
          const x = (touch.x - rect.left) / zoom + (engineRef.current?.camera.x || 0);
          const y = (touch.y - rect.top) / zoom + (engineRef.current?.camera.y || 0);
          
          const gx = Math.floor(x / TILE_SIZE);
          const gy = Math.floor(y / TILE_SIZE);
          
          const engine = engineRef.current;
          if (engine) {
            const baseId = engine.baseMap[gy]?.[gx];
            const clickedBuilding = engine.getBuildingAt(gx, gy);
            const isOwnBase = baseId && engine.player.claimedBaseId === baseId;
            
            if (clickedBuilding || isOwnBase || (baseId && !engine.player.claimedBaseId)) {
              if (baseId && !engine.player.claimedBaseId) {
                engine.claimBase(engine.player, baseId);
              }
              // Force local update
              setSelectedTile({ x: gx, y: gy });
              engine._selectedTile = { x: gx, y: gy };

              if (isOwnBase) {
                engine.camera.x = (gx * TILE_SIZE + TILE_SIZE/2) - (rect.width / 2) / zoom;
                engine.camera.y = (gy * TILE_SIZE + TILE_SIZE/2) - (rect.height / 2) / zoom;
                engine.panningActive = true; 
              }
            } else {
              setSelectedTile(null);
              engine._selectedTile = null;
            }
          }
      }
      setLastTouches([]);
      setLastPinchDist(null);
      // Removed automatic reset to allow persistent panning
      // if (engineRef.current) engineRef.current.panningActive = false; 
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setLastTouches([{ x: touch.clientX, y: touch.clientY, id: touch.identifier }]);
      setLastPinchDist(null);
    }
  };

  const [activeCategory, setActiveCategory] = useState<'defense' | 'offense' | 'resource' | 'forbidden'>('defense');

  const categories = {
    defense: [BuildingType.WOOD_WALL, BuildingType.REPAIR_HUT],
    resource: [BuildingType.LUMBER_SHACK, BuildingType.GOLD_MINE],
    offense: [BuildingType.GUARD_TOWER],
    forbidden: [
      BuildingType.SOULGUARD_TOWER, 
      BuildingType.SIEGE_CANNON, 
      BuildingType.SUPPLY_NODE,
      BuildingType.VOID_COLLECTOR,
      BuildingType.ESSENCE_DISTILLER,
      BuildingType.ABYSSAL_SPIRE
    ]
  };

  const unlockTower = (type: BuildingType) => {
     if (engineRef.current && engineRef.current.player.forbiddenKnowledge >= 1) {
        if (!engineRef.current.player.unlockedBuildings.has(type as any)) {
            engineRef.current.player.forbiddenKnowledge -= 1;
            engineRef.current.player.unlockedBuildings.add(type as any);
            setResources(prev => ({
                ...prev,
                forbiddenKnowledge: engineRef.current!.player.forbiddenKnowledge
            }));
        }
     }
  };

  const isPlayersBaseAtTile = !!(
    selectedTile && 
    engineRef.current?.player.claimedBaseId && 
    engineRef.current?.baseMap[selectedTile.y]?.[selectedTile.x] === engineRef.current?.player.claimedBaseId
  );

  const build = (type: BuildingType) => {
    if (selectedTile && engineRef.current) {
      const player = engineRef.current.player;
      const baseId = engineRef.current.baseMap[selectedTile.y]?.[selectedTile.x];
      
      // Allow building if it's your base OR if the base is currently unclaimed
      const isUnclaimedBase = baseId && ![player, ...engineRef.current.aiWardens].some(w => w.claimedBaseId === baseId);
      const isAllowedToBuild = isPlayersBaseAtTile || isUnclaimedBase;

      if (!isAllowedToBuild) return;

      const success = engineRef.current.tryPlaceBuilding(selectedTile.x, selectedTile.y, type);
      if (success) {
        // Refresh local resources immediately
        setResources({
          wood: Math.floor(player.wood),
          gold: Math.floor(player.gold),
          demonHp: engineRef.current.demon ? Math.floor(engineRef.current.demon.hp) : 1000,
          demonMaxHp: engineRef.current.demon ? engineRef.current.demon.maxHp : 1000
        });
        
        // This re-render will now detect the building at selectedTile and switch to upgrade view
      }
    }
  };

  const repair = () => {
    if (selectedTile && engineRef.current) {
      const building = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (building) {
        const success = engineRef.current.repairBuilding(building);
        if (success) {
           setResources({
             wood: Math.floor(engineRef.current.player.wood),
             gold: Math.floor(engineRef.current.player.gold),
             hp: Math.floor(engineRef.current.player.hp),
             isLumbering: engineRef.current.player.isLumbering,
             forbiddenKnowledge: engineRef.current.player.forbiddenKnowledge
           });
        }
      }
    }
  };

  const upgradeTo = (newType: BuildingType) => {
    if (selectedTile && engineRef.current) {
      const building = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (building) {
        const stats = BUILDINGS[newType];
        const player = engineRef.current.player;
        if (player.wood >= stats.costWood && player.gold >= stats.costGold) {
          player.wood -= stats.costWood;
          player.gold -= stats.costGold;
          building.evolve(newType);
          engineRef.current.checkFKMilestones(player, building);
          
          setResources({
            wood: Math.floor(player.wood),
            gold: Math.floor(player.gold),
            demonHp: engineRef.current.demon ? Math.floor(engineRef.current.demon.hp) : 1000,
            demonMaxHp: engineRef.current.demon ? engineRef.current.demon.maxHp : 1000
          });
        }
      }
    }
  };

  const sell = () => {
    if (selectedTile && engineRef.current) {
      const building = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (building) {
        engineRef.current.sellBuilding(building);
        
        setResources({
          wood: Math.floor(engineRef.current.player.wood),
          gold: Math.floor(engineRef.current.player.gold),
          demonHp: engineRef.current.demon ? Math.floor(engineRef.current.demon.hp) : 1000,
          demonMaxHp: engineRef.current.demon ? engineRef.current.demon.maxHp : 1000
        });
        
        setSelectedTile(null);
        engineRef.current._selectedTile = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoystickMove = (data: { x: number, y: number }) => {
    if (engineRef.current) {
      engineRef.current.joystick.x = data.x;
      engineRef.current.joystick.y = data.y;
    }
  };

  const handleJoystickEnd = () => {
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  const selectedBuildingAtTile = selectedTile && engineRef.current?.getBuildingAt(selectedTile.x, selectedTile.y);
  const selectedBuildingStats = selectedBuildingAtTile ? BUILDINGS[selectedBuildingAtTile.type] : null;

  const isUnlocked = (type: BuildingType) => {
    // Basic structures are always unlocked
    if (
      type === BuildingType.WOOD_WALL || 
      type === BuildingType.GUARD_TOWER || 
      type === BuildingType.GOLD_MINE || 
      type === BuildingType.REPAIR_HUT || 
      type === BuildingType.LUMBER_SHACK ||
      type === BuildingType.LUMBER_MILL ||
      type === BuildingType.ARCHER_TOWER ||
      type === BuildingType.BOMB_TOWER ||
      type === BuildingType.FROST_TOWER ||
      type === BuildingType.FIRE_TOWER
    ) return true;
    
    // Check if it's a forbidden tower - these require manual unlocking
    if (categories.forbidden.includes(type)) {
       return engineRef.current?.player.unlockedBuildings.has(type as any);
    }
    
    // All standard upgrades are unlocked once you progress to them
    return true;
  };

  const hasMill = engineRef.current?.buildings.some(b => 
    b.owner === engineRef.current?.player && 
    b.type.includes('LUMBER_')
  );

  const handleWheel = (e: React.WheelEvent) => {
    if (engineRef.current) {
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? (1 - zoomSpeed) : (1 + zoomSpeed);
        engineRef.current.zoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * delta));
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#050805] overflow-hidden font-sans text-gray-100 touch-none"
      tabIndex={0}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas 
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block cursor-crosshair w-full h-full"
      />

      {/* Main Menu */}
      <AnimatePresence>
        {gameState === GameState.MENU && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0a0f0a]/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center"
          >
            <motion.h1 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="text-8xl font-black mb-2 tracking-[-4px] uppercase italic text-white"
            >
              WARDENS
            </motion.h1>
            <p className="text-[14px] text-gray-400 uppercase tracking-[4px] mb-12">
              Defend the clearings. Survive the night.
            </p>
            
            <button 
              id="btn-play"
              onClick={startGame}
              className="bg-white text-black py-4 px-12 rounded-full font-bold text-lg uppercase tracking-wider transition-transform hover:scale-105 active:scale-95"
            >
              Enter Forest
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD overlay */}
      {gameState === GameState.PLAYING && (
        <>
          {/* Top Info Bar */}
          <div className="absolute top-0 left-0 right-0 p-2 sm:p-6 flex flex-row justify-between items-start gap-1 sm:gap-4 pointer-events-none z-10 scale-90 sm:scale-100 origin-top-left">
            <div className="flex flex-row gap-1 sm:gap-4 pointer-events-auto">
              <div className="hud-glass rounded-lg sm:rounded-xl p-1.5 sm:p-3 flex gap-2 sm:gap-6">
                <div className="flex flex-col">
                  <span className="text-[7px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-bold leading-none mb-0.5">Wood</span>
                  <div className="flex items-center gap-0.5 sm:gap-2">
                    <Axe className="text-wood w-2.5 h-2.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-xl font-mono font-bold text-wood">{resources.wood}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-bold leading-none mb-0.5">Gold</span>
                  <div className="flex items-center gap-0.5 sm:gap-2">
                    <Coins className="text-gold w-2.5 h-2.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-xl font-mono font-bold text-gold">{resources.gold}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-bold leading-none mb-0.5">Health</span>
                  <div className="flex items-center gap-0.5 sm:gap-2">
                    <Heart className="text-hp w-2.5 h-2.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-xl font-mono font-bold text-hp">{resources.hp}</span>
                  </div>
                </div>
              </div>

              {/* Forbidden Knowledge HUD Item */}
              <div className="hud-glass rounded-lg sm:rounded-xl px-2 sm:px-6 py-1.5 sm:py-3 flex items-center gap-1.5 sm:gap-4 group h-[34px] sm:h-auto">
                <div className="w-5 h-5 sm:w-10 sm:h-10 bg-[#a855f7]/20 border border-[#a855f7]/50 rounded flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <Zap className="w-3 h-3 sm:w-6 sm:h-6 text-[#a855f7] animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-[#a855f7]/70 leading-none mb-0.5">Knowledge</span>
                  <span className="text-xs sm:text-2xl font-mono font-bold tracking-tight text-[#a855f7]">
                    {resources.forbiddenKnowledge}
                  </span>
                </div>
              </div>
            </div>

            {!isPlayerInView && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 sm:px-6 sm:py-3 rounded-full flex items-center gap-2 pointer-events-auto backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  if (engineRef.current?.player.claimedBaseId) {
                    const base = BASES.find(b => b.id === engineRef.current?.player.claimedBaseId);
                    if (base) {
                       engineRef.current.snapToPosition(base.centerX * TILE_SIZE + TILE_SIZE/2, base.centerY * TILE_SIZE + TILE_SIZE/2);
                    } else {
                       engineRef.current.snapToPlayer();
                    }
                  } else {
                    engineRef.current?.snapToPlayer();
                  }
                }}
              >
                <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white">Focus Base</span>
              </motion.button>
            )}

            <div className="pointer-events-auto flex flex-col items-end gap-1 sm:gap-2 ml-auto origin-top-right">
               <div className="hud-glass rounded-lg sm:rounded-xl px-2 sm:px-6 py-1 sm:py-3 text-right">
                 <div className={`text-[7px] sm:text-[12px] font-bold uppercase tracking-[1px] sm:tracking-[2px] mb-0.5 sm:mb-1 ${gameInfo.timer > 30 ? 'text-hp animate-pulse' : 'text-emerald-400'}`}>
                   {gameInfo.timer <= 30 ? `Prep` : `Lv.${gameInfo.demonLevel}`}
                 </div>
                 <div className="text-sm sm:text-3xl font-mono font-bold tracking-tight">
                   {gameInfo.timer <= 30 ? formatTime(30 - gameInfo.timer) : formatTime(gameInfo.timer)}
                 </div>
               </div>
            </div>
          </div>

          {/* New RTS Bottom Console */}
          <AnimatePresence>
            {selectedTile && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 z-30 pointer-events-none backdrop-blur-[1px]"
                />
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                  className="absolute bottom-0 left-0 right-0 h-[280px] sm:h-[320px] rts-panel z-40 p-0 pointer-events-auto overflow-hidden"
                >
                  <div className="max-w-7xl mx-auto h-full flex flex-col sm:flex-row gap-1 p-2 sm:p-3">
                    {/* LEFT: Portrait & Health */}
                    <div className="w-full sm:w-[300px] h-[80px] sm:h-full flex flex-row sm:flex-col gap-2 shrink-0">
                      <div className="bg-[#1a140f] border-4 border-[#3d2b1f] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] p-2 sm:p-4 flex-1 flex flex-row sm:flex-col items-center justify-between text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#fbbf24]/50 to-transparent" />
                        
                        <div className="flex-1 flex flex-row sm:flex-col items-center justify-center gap-3">
                          <div className="text-3xl sm:text-6xl drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] animate-float">
                            {!selectedBuildingAtTile ? '👷' : selectedBuildingStats?.icon || '🏰'}
                          </div>
                          <div className="text-left sm:text-center">
                            <h3 className="text-[#fbbf24] font-black text-xs sm:text-lg uppercase tracking-widest leading-none mb-1">
                              {selectedBuildingAtTile ? selectedBuildingAtTile.getDynamicName() : (isPlayersBaseAtTile ? "BUILD" : "Unclaimed")}
                            </h3>
                            <p className="text-[8px] sm:text-[10px] text-[#8b5e3c] font-black uppercase tracking-widest hidden sm:block">
                              {selectedBuildingAtTile ? selectedBuildingStats?.description : (isPlayersBaseAtTile ? "Orders Needed" : "Claim your base.")}
                            </p>
                          </div>
                        </div>

                        {selectedBuildingAtTile && (
                          <div className="w-[120px] sm:w-full mt-auto">
                            <div className="flex justify-between text-[8px] sm:text-[11px] font-black text-[#fbbf24] uppercase mb-1 px-1">
                              <span className="hidden sm:inline">Integrity</span>
                              <span>{Math.floor(selectedBuildingAtTile.hp)} / {selectedBuildingAtTile.maxHp}</span>
                            </div>
                            <div className="w-full h-2 sm:h-3 bg-[#0d0a08] border border-2 border-[#3d2b1f] rounded-none overflow-hidden p-[1px] sm:p-[2px]">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(selectedBuildingAtTile.hp / selectedBuildingAtTile.maxHp) * 100}%` }}
                                className={`h-full ${selectedBuildingAtTile.hp / selectedBuildingAtTile.maxHp < 0.3 ? 'bg-rose-600' : 'bg-emerald-500'}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CENTER: Evolution / Build Cards */}
                    <div className="flex-1 flex flex-col gap-1 sm:gap-2 h-full overflow-hidden">
                      <div className="flex items-center gap-1 sm:gap-2 px-1">
                        {!selectedBuildingAtTile ? (
                          (['defense', 'offense', 'resource', 'forbidden'] as const).map(cat => (
                            <button
                              key={cat}
                              onClick={() => setActiveCategory(cat)}
                              className={`px-3 sm:px-4 py-1 sm:py-2 border-b-2 sm:border-b-4 transition-all uppercase font-black tracking-widest text-[8px] sm:text-[10px] ${
                                activeCategory === cat 
                                  ? 'bg-[#fbbf24] text-[#1a140f] border-[#b48618]' 
                                  : 'bg-[#1a140f] text-[#8b5e3c] border-[#3d2b1f] hover:text-[#fbbf24]'
                                } ${cat === 'forbidden' ? 'border-[#a855f7]/50 text-[#a855f7]' : ''}`}
                            >
                              {cat}
                            </button>
                          ))
                        ) : (
                          <div className="flex gap-2">
                             <div className={`px-3 sm:px-6 py-1 sm:py-2 font-black uppercase tracking-widest text-[8px] sm:text-xs border-b-2 sm:border-b-4 ${
                               selectedBuildingAtTile.owner === engineRef.current?.player 
                                 ? "bg-[#fbbf24] text-[#1a140f] border-[#b48618]" 
                                 : "bg-[#1a140f] text-[#8b5e3c] border-[#3d2b1f]"
                             }`}>
                               {selectedBuildingAtTile.owner === engineRef.current?.player ? "EVOLUTION" : "OBSERVING"}
                             </div>
                             {selectedBuildingAtTile.owner === engineRef.current?.player && (
                               <div className="bg-[#1a140f] text-[#8b5e3c] px-3 sm:px-6 py-1 sm:py-2 font-black uppercase tracking-widest text-[8px] sm:text-xs border-b-2 sm:border-b-4 border-[#3d2b1f]">
                                 STRENGTHEN
                               </div>
                             )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 bg-[#1a140f] border-2 sm:border-4 border-[#3d2b1f] shadow-[inset_0_0_30px_rgba(0,0,0,0.9)] p-2 sm:p-4 flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar items-center relative">
                        {selectedBuildingAtTile ? (
                           <div className="flex h-full gap-2 sm:gap-4 w-full">
                              {/* Evolution Column */}
                              {selectedBuildingAtTile.owner === engineRef.current?.player ? (
                                <div className="flex-1 flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar items-center">
                                  {selectedBuildingStats?.upgradesTo && selectedBuildingStats.upgradesTo.length > 0 ? (
                                    selectedBuildingStats.upgradesTo.map(nextType => {
                                      const stats = BUILDINGS[nextType];
                                      const canAfford = resources.wood >= stats.costWood && resources.gold >= stats.costGold;
                                      const unlocked = isUnlocked(nextType);
                                      return (
                                        <motion.button
                                          key={nextType}
                                          disabled={!canAfford || !unlocked}
                                          onClick={() => upgradeTo(nextType)}
                                          className="group relative w-24 sm:w-48 h-full bg-gradient-to-b from-[#2a1f18] to-[#120a06] border-2 border-[#fbbf24]/30 p-1 sm:p-4 flex flex-col items-center justify-between shadow-2xl transition-all hover:border-[#fbbf24] disabled:opacity-30 shrink-0"
                                        >
                                          {!unlocked && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[7px] sm:text-[10px] font-black uppercase p-1 text-center text-rose-500 overflow-hidden"><Lock className="w-4 h-4 sm:w-8 sm:h-8 mb-0.5 sm:mb-2"/> Needs Science</div>}
                                          <div className="absolute top-0.5 left-1 text-[5px] sm:text-[8px] font-black text-[#fbbf24] opacity-50 uppercase tracking-widest italic">Evolve</div>
                                          <span className="text-2xl sm:text-6xl mt-0.5 sm:mt-2 group-hover:scale-110 transition-transform">{stats.icon}</span>
                                          <div className="text-center w-full grow flex flex-col justify-center px-0.5">
                                            <div className="text-[7px] sm:text-xs font-black text-[#fbbf24] uppercase tracking-widest leading-none sm:mb-1">{stats.label}</div>
                                            <div className="text-[5px] sm:text-[8px] text-gray-500 uppercase font-bold mt-0.5 line-clamp-1 sm:line-clamp-2">{stats.description}</div>
                                            <div className="flex justify-center gap-1.5 sm:gap-4 mt-auto border-t border-[#3d2b1f] pt-0.5 sm:pt-2">
                                              <div className="flex items-center gap-0.5 font-mono text-[7px] sm:text-[10px]">
                                                <Axe className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-emerald-500" />
                                                {stats.costWood}
                                              </div>
                                              <div className="flex items-center gap-0.5 font-mono text-[7px] sm:text-[10px]">
                                                <Coins className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-gold" />
                                                {stats.costGold}
                                              </div>
                                              {stats.fkCost ? (
                                                <div className="flex items-center gap-0.5 font-mono text-[7px] sm:text-[10px] text-[#a855f7]">
                                                  <Zap className="w-1.5 h-1.5 sm:w-3 sm:h-3" />
                                                  {stats.fkCost}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </motion.button>
                                      );
                                    })
                                  ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-[#8b5e3c]/50">
                                      <Shield className="w-8 h-8 sm:w-16 sm:h-16 mb-2" />
                                      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Max Evolution</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-[#8b5e3c]/50 p-4 border border-dashed border-[#3d2b1f]">
                                  <Skull className="w-8 h-8 sm:w-12 sm:h-12 mb-2 text-[#fbbf24]/30" />
                                  <span className="text-[8px] sm:text-xs font-black uppercase tracking-widest text-center">Owned by Rival Domain</span>
                                  <p className="text-[6px] sm:text-[8px] text-[#8b5e3c]/40 mt-1 uppercase">You cannot issue commands to rival structures.</p>
                                </div>
                              )}
                           </div>
                        ) : (
                          // Build mode
                          activeCategory === 'forbidden' ? (
                            categories.forbidden.map(type => {
                              const stats = BUILDINGS[type];
                              const canAfford = resources.wood >= stats.costWood && 
                                               resources.gold >= stats.costGold && 
                                               resources.forbiddenKnowledge >= (stats.fkCost || 0);

                              return (
                                  <motion.div 
                                    key={type}
                                    whileHover={{ scale: canAfford ? 1.05 : 1 }}
                                    whileTap={{ scale: canAfford ? 0.95 : 1 }}
                                    onClick={() => canAfford && build(type)}
                                    className={`group relative w-24 sm:w-56 shrink-0 h-full bg-gradient-to-b from-[#1e1b4b] to-[#020617] border-2 p-1 sm:p-4 flex flex-col items-center justify-between shadow-2xl cursor-pointer transition-all ${
                                      canAfford ? 'border-[#a855f7]/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-[#3d2b1f] opacity-40 grayscale pointer-events-none'
                                    }`}
                                   >
                                     <span className="text-2xl sm:text-5xl mt-0.5 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] group-hover:scale-110 transition-transform">{stats.icon}</span>
                                    <div className="text-center w-full grow flex flex-col justify-center px-0.5">
                                      <h4 className="text-[#a855f7] font-black text-[7px] sm:text-xs uppercase mb-0.5 leading-none">{stats.label}</h4>
                                      <p className="text-[5px] sm:text-[8px] text-indigo-300 font-bold uppercase tracking-tight mb-0.5 line-clamp-1 sm:line-clamp-2">{stats.description}</p>
                                      
                                      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-0.5 mt-auto">
                                        <div className="flex justify-center gap-1 items-center">
                                          <div className="flex items-center gap-0.5 text-[6px] sm:text-[9px] font-mono text-emerald-400">
                                            <Axe className="w-1.5 h-1.5 sm:w-2 sm:h-2" />{stats.costWood}
                                          </div>
                                          <div className="flex items-center gap-0.5 text-[6px] sm:text-[9px] font-mono text-amber-400">
                                            <Coins className="w-1.5 h-1.5 sm:w-2 sm:h-2" />{stats.costGold}
                                          </div>
                                          {stats.fkCost ? (
                                            <div className="flex items-center gap-0.5 text-[6px] sm:text-[9px] font-mono text-[#a855f7]">
                                              <Zap className="w-1.5 h-1.5 sm:w-2 sm:h-2" />{stats.fkCost}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                              )
                            })
                          ) : (
                            categories[activeCategory as 'defense' | 'offense' | 'resource'].filter(t => isUnlocked(t)).map(type => {
                              const stats = BUILDINGS[type];
                              const canAfford = resources.wood >= stats.costWood && resources.gold >= stats.costGold;
                              return (
                                <motion.button
                                  whileHover={{ scale: 1.05, y: -5 }}
                                  whileTap={{ scale: 0.95 }}
                                  key={type}
                                  disabled={!canAfford}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    build(type);
                                  }}
                                  className="group relative w-24 sm:w-44 shrink-0 h-full bg-[#2a1f18] border-2 border-[#3d2b1f] p-1 sm:p-3 flex flex-col items-center justify-between transition-all hover:border-[#fbbf24] disabled:opacity-40 disabled:grayscale overflow-hidden"
                                >
                                  <span className="text-2xl sm:text-5xl mt-0.5 group-hover:scale-110 transition-transform">{stats.icon}</span>
                                  <div className="text-center w-full grow flex flex-col justify-center px-0.5">
                                    <h4 className="text-[#fbbf24] font-black text-[7px] sm:text-[10px] uppercase tracking-widest leading-none mb-0.5">{stats.label}</h4>
                                    <p className="text-[4px] sm:text-[8px] text-gray-500 uppercase font-bold mb-0.5 line-clamp-1 sm:line-clamp-2">{stats.description}</p>
                                    <div className="flex justify-center gap-1 sm:gap-3 border-t border-[#3d2b1f] pt-0.5 mt-auto">
                                      <div className="flex items-center gap-0.5">
                                        <Axe className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-emerald-500" />
                                        <span className="text-[6px] sm:text-[10px] font-mono font-bold">{stats.costWood}</span>
                                      </div>
                                      {stats.costGold > 0 && (
                                        <div className="flex items-center gap-0.5">
                                          <Coins className="w-1.5 h-1.5 sm:w-3 sm:h-3 text-gold" />
                                          <span className="text-[6px] sm:text-[10px] font-mono font-bold">{stats.costGold}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.button>
                              );
                            })
                          )
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="w-full sm:w-[120px] flex flex-row sm:flex-col gap-1 sm:gap-2 shrink-0 h-[44px] sm:h-auto">
                      <button 
                        onClick={() => {
                          setSelectedTile(null);
                          if (engineRef.current) engineRef.current._selectedTile = null;
                          modalClosedTime.current = performance.now();
                        }}
                        className="flex-1 sm:h-12 bg-[#3d1f1f] border-2 sm:border-4 border-[#5a2e2e] text-[#f87171] font-black uppercase tracking-widest text-[8px] sm:text-[10px] hover:bg-rose-700 hover:text-white transition-all flex items-center justify-center"
                      >
                        CLOSE
                      </button>
                      <button 
                        disabled={!selectedBuildingAtTile || selectedBuildingAtTile.hp >= selectedBuildingAtTile.maxHp}
                        onClick={repair}
                        className="flex-1 bg-[#1a140f] border-2 sm:border-4 border-[#3d2b1f] text-[#8b5e3c] hover:text-emerald-500 hover:border-emerald-900/50 flex flex-row sm:flex-col items-center justify-center group disabled:opacity-30 disabled:grayscale transition-all gap-1 sm:gap-2 px-1"
                      >
                        <Wrench className="w-3 h-3 sm:w-6 sm:h-6 group-hover:rotate-45 transition-transform shrink-0" />
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-center">Repair</span>
                          <div className="flex gap-1 mt-0.5 sm:mt-1">
                             <div className="flex items-center gap-0.5 text-[6px] sm:text-[9px] font-mono text-emerald-400">
                               <Axe className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5" />{selectedBuildingStats?.costWood}
                             </div>
                             {selectedBuildingStats?.costGold ? (
                               <div className="flex items-center gap-0.5 text-[6px] sm:text-[9px] font-mono text-amber-400">
                                 <Coins className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5" />{selectedBuildingStats.costGold}
                               </div>
                             ) : null}
                          </div>
                        </div>
                      </button>
                      <button 
                        disabled={!selectedBuildingAtTile}
                        onClick={sell}
                        className="flex-1 bg-[#1a140f] border-2 sm:border-4 border-[#3d2b1f] text-[#8b5e3c] hover:text-rose-500 hover:border-rose-900/50 flex flex-row sm:flex-col items-center justify-center group disabled:opacity-30 disabled:grayscale transition-all gap-2"
                      >
                        <Skull className="w-3 h-3 sm:w-6 sm:h-6 sm:mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-center">Sell</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        
        {/* Base Claim UI */}
        <AnimatePresence>
          {hasClaimedBase && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 bg-green-500/20 backdrop-blur-md border border-green-500/50 px-6 py-2 rounded-full flex items-center gap-3 z-30 pointer-events-none"
            >
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-100 font-bold uppercase tracking-widest text-[10px]">Base Claimed: Altar Active</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Joystick Visual */}
        <AnimatePresence>
          {joystickOrigin && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="fixed z-50 pointer-events-none"
              style={{
                left: joystickOrigin.x,
                top: joystickOrigin.y,
                width: 100,
                height: 100,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-full h-full rounded-full border-2 border-white/10 bg-white/5 backdrop-blur-[2px] flex items-center justify-center">
                <div className="absolute w-1 h-full bg-white/5" />
                <div className="absolute h-1 w-full bg-white/5" />
                <motion.div
                   animate={{
                     x: (engineRef.current?.joystick.x || 0) * 35,
                     y: (engineRef.current?.joystick.y || 0) * 35,
                   }}
                   className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 shadow-xl"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
      )}

      {/* Game Over */}
      <AnimatePresence>
        {gameState === GameState.GAMEOVER && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[#0a0f0a]/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] p-6 text-center"
          >
            <h2 className="text-8xl font-black mb-2 italic tracking-tighter text-rose-600">DEFEATED</h2>
            <p className="text-[14px] text-gray-500 uppercase tracking-widest mb-12">The forest claimed your soul.</p>
            
            <div className="hud-glass p-8 rounded-xl mb-12 w-full max-w-sm">
               <div className="flex justify-between mb-4 border-b border-white/5 pb-2">
                 <span className="text-gray-500 uppercase text-xs tracking-wider">Survived</span>
                 <span className="font-mono text-2xl font-bold">{formatTime(gameInfo.timer)}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-gray-500 uppercase text-xs tracking-wider">Demon Power</span>
                 <span className="font-mono text-2xl font-bold text-hp">LVL {gameInfo.demonLevel}</span>
               </div>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="bg-white text-black py-4 px-12 rounded-full font-bold text-lg uppercase tracking-wider transition-all hover:scale-105"
            >
              Retry Journey
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
