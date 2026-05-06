import React, { useEffect, useRef, useState, MouseEvent, TouchEvent, WheelEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, Home, HelpCircle, Trophy, Axe, Coins, Heart, Hammer, Shield, ArrowUp, Zap, TowerControl as Tower, Skull, LogOut, Wrench, Lock
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { GameState, BuildingType, BUILDINGS, TILE_SIZE, BASES } from './game/constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [resources, setResources] = useState({ 
    wood: 0, gold: 0, hp: 100, isLumbering: false, forbiddenKnowledge: 0 
  });
  const [hasClaimedBase, setHasClaimedBase] = useState(false);
  const lastClaimedId = useRef<string | null>(null);
  const [gameInfo, setGameInfo] = useState({ demonLevel: 1, timer: 0 });
  const [selectedTile, setSelectedTile] = useState<{ x: number, y: number } | null>(null);
  const [isPlayerInView, setIsPlayerInView] = useState(true);
  const [panningActive, setPanningActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'defense' | 'offense' | 'resource' | 'forbidden'>('defense');

  // Unified Touch State
  const [touchStart, setTouchStart] = useState<{ x: number, y: number, time: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number, y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);

  const categories = {
    defense: [BuildingType.WOOD_WALL, BuildingType.REPAIR_HUT],
    resource: [BuildingType.LUMBER_SHACK, BuildingType.GOLD_MINE],
    offense: [BuildingType.GUARD_TOWER],
    forbidden: [
      BuildingType.SOULGUARD_TOWER, BuildingType.SIEGE_CANNON, BuildingType.SUPPLY_NODE,
      BuildingType.VOID_COLLECTOR, BuildingType.ESSENCE_DISTILLER, BuildingType.ABYSSAL_SPIRE
    ]
  };

  useEffect(() => {
    if (hasClaimedBase) {
      const timer = setTimeout(() => setHasClaimedBase(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [hasClaimedBase]);

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
    window.addEventListener('resize', handleResize);
    handleResize();
    
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
        }
        setGameInfo({ demonLevel: engineRef.current.demon?.level || 1, timer: Math.floor(engineRef.current.timer) });
        setPanningActive(engineRef.current.panningActive);
        if (engineRef.current.player.isDead) setGameState(GameState.GAMEOVER);
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(updateInterval);
    };
  }, []);

  // --- MASTER TOUCH CONTROLLER ---
  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.pointer-events-auto, .rts-panel, button')) return; // Ignore UI touches

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
      setLastPinchDist(null);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      setLastPinchDist(Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY));
      setTouchStart(null);
      setJoystickPos(null);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!engineRef.current) return;

    if (e.touches.length === 2 && lastPinchDist !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const zoomFactor = dist / lastPinchDist;
      engineRef.current.zoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * zoomFactor));
      setLastPinchDist(dist);
      return;
    }

    if (e.touches.length === 1 && touchStart) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) { // Dragging
        if (!engineRef.current.player.claimedBaseId) {
          // Undocked: Move Player via Joystick
          setJoystickPos({ x: touch.clientX, y: touch.clientY });
          engineRef.current.joystick.x = Math.max(-1, Math.min(1, dx / 50));
          engineRef.current.joystick.y = Math.max(-1, Math.min(1, dy / 50));
        } else {
          // Docked: Pan Camera
          engineRef.current.camera.x -= dx / engineRef.current.zoom;
          engineRef.current.camera.y -= dy / engineRef.current.zoom;
          setTouchStart({ x: touch.clientX, y: touch.clientY, time: touchStart.time }); // Reset origin for smooth pan
          engineRef.current.panningActive = true;
        }
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
    setJoystickPos(null);
    
    if (e.changedTouches.length === 1 && touchStart) {
      const touch = e.changedTouches[0];
      const duration = Date.now() - touchStart.time;
      const dist = Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y);

      // TAP DETECTION
      if (duration < 300 && dist < 15) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const zoom = engineRef.current!.zoom;
        const x = (touch.clientX - rect.left) / zoom + engineRef.current!.camera.x;
        const y = (touch.clientY - rect.top) / zoom + engineRef.current!.camera.y;
        
        const gx = Math.floor(x / TILE_SIZE);
        const gy = Math.floor(y / TILE_SIZE);
        
        const baseId = engineRef.current!.baseMap[gy]?.[gx];
        const clickedBuilding = engineRef.current!.getBuildingAt(gx, gy);
        const isOwnBase = baseId && engineRef.current!.player.claimedBaseId === baseId;
        
        if (clickedBuilding || isOwnBase || (baseId && !engineRef.current!.player.claimedBaseId)) {
          if (baseId && !engineRef.current!.player.claimedBaseId) {
            engineRef.current!.claimBase(engineRef.current!.player, baseId);
          }
          // TRIGGER UI
          setSelectedTile({ x: gx, y: gy });
          engineRef.current!._selectedTile = { x: gx, y: gy };

          if (isOwnBase) {
            engineRef.current!.camera.x = (gx * TILE_SIZE + TILE_SIZE/2) - (rect.width / 2) / zoom;
            engineRef.current!.camera.y = (gy * TILE_SIZE + TILE_SIZE/2) - (rect.height / 2) / zoom;
            engineRef.current!.panningActive = true; 
          }
        } else {
          setSelectedTile(null);
          engineRef.current!._selectedTile = null;
        }
      }
    }
    setTouchStart(null);
  };

  const handleWheel = (e: WheelEvent) => {
    if (engineRef.current) {
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? (1 - zoomSpeed) : (1 + zoomSpeed);
        engineRef.current.zoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * delta));
    }
  };

  // --- GAME LOGIC ---
  const isUnlocked = (type: BuildingType) => {
    if ([BuildingType.WOOD_WALL, BuildingType.GUARD_TOWER, BuildingType.GOLD_MINE, BuildingType.REPAIR_HUT, BuildingType.LUMBER_SHACK, BuildingType.LUMBER_MILL, BuildingType.ARCHER_TOWER, BuildingType.BOMB_TOWER, BuildingType.FROST_TOWER, BuildingType.FIRE_TOWER].includes(type)) return true;
    if (categories.forbidden.includes(type)) return engineRef.current?.player.unlockedBuildings.has(type as any);
    return true;
  };

  const build = (type: BuildingType) => {
    if (selectedTile && engineRef.current) {
      const player = engineRef.current.player;
      const baseId = engineRef.current.baseMap[selectedTile.y]?.[selectedTile.x];
      const isUnclaimedBase = baseId && ![player, ...engineRef.current.aiWardens].some(w => w.claimedBaseId === baseId);
      const isPlayersBaseAtTile = !!(engineRef.current.player.claimedBaseId && engineRef.current.baseMap[selectedTile.y]?.[selectedTile.x] === engineRef.current.player.claimedBaseId);

      if (!isPlayersBaseAtTile && !isUnclaimedBase) return;

      if (engineRef.current.tryPlaceBuilding(selectedTile.x, selectedTile.y, type)) {
        setResources(prev => ({...prev}));
      }
    }
  };

  const repair = () => {
    if (selectedTile && engineRef.current) {
      const building = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (building) {
        engineRef.current.repairBuilding(building);
        setResources(prev => ({...prev}));
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
          setResources(prev => ({...prev}));
        }
      }
    }
  };

  const sell = () => {
    if (selectedTile && engineRef.current) {
      const building = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (building) {
        engineRef.current.sellBuilding(building);
        setSelectedTile(null);
        engineRef.current._selectedTile = null;
        setResources(prev => ({...prev}));
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedBuildingAtTile = selectedTile && engineRef.current?.getBuildingAt(selectedTile.x, selectedTile.y);
  const selectedBuildingStats = selectedBuildingAtTile ? BUILDINGS[selectedBuildingAtTile.type] : null;
  const isPlayersBaseAtTile = !!(selectedTile && engineRef.current?.player.claimedBaseId && engineRef.current?.baseMap[selectedTile.y]?.[selectedTile.x] === engineRef.current?.player.claimedBaseId);

  return (
    <div 
      className="relative w-full h-screen bg-[#050805] overflow-hidden font-sans text-gray-100 touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block cursor-crosshair w-full h-full" />

      {/* DYNAMIC VIRTUAL JOYSTICK */}
      <AnimatePresence>
        {touchStart && joystickPos && !engineRef.current?.player.claimedBaseId && (
          <motion.div 
            className="absolute pointer-events-none z-50"
            style={{ left: touchStart.x - 50, top: touchStart.y - 50 }}
          >
            <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
              <div 
                className="w-10 h-10 bg-white/40 rounded-full shadow-lg"
                style={{ 
                  transform: `translate(${Math.min(50, Math.max(-50, joystickPos.x - touchStart.x))}px, ${Math.min(50, Math.max(-50, joystickPos.y - touchStart.y))}px)` 
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState === GameState.MENU && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0a0f0a]/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center">
            <motion.h1 initial={{ y: -50 }} animate={{ y: 0 }} className="text-8xl font-black mb-2 tracking-[-4px] uppercase italic text-white">WARDENS</motion.h1>
            <p className="text-[14px] text-gray-400 uppercase tracking-[4px] mb-12">Defend the clearings. Survive the night.</p>
            <button onClick={() => { setGameState(GameState.PLAYING); engineRef.current?.start(); }} className="bg-white text-black py-4 px-12 rounded-full font-bold text-lg uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 pointer-events-auto">
              Enter Forest
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === GameState.PLAYING && (
        <>
          <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none z-10">
            <div className="flex flex-wrap gap-2 pointer-events-auto">
              <div className="hud-glass rounded-xl p-2 flex gap-3">
                <div className="flex flex-col"><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Wood</span><div className="flex items-center gap-1"><Axe className="text-wood w-4 h-4" /><span className="text-xl font-mono font-bold text-wood">{resources.wood}</span></div></div>
                <div className="flex flex-col"><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Gold</span><div className="flex items-center gap-1"><Coins className="text-gold w-4 h-4" /><span className="text-xl font-mono font-bold text-gold">{resources.gold}</span></div></div>
                <div className="flex flex-col"><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Health</span><div className="flex items-center gap-1"><Heart className="text-hp w-4 h-4" /><span className="text-xl font-mono font-bold text-hp">{resources.hp}</span></div></div>
              </div>
              <div className="hud-glass rounded-xl px-3 py-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-[#a855f7]/20 border border-[#a855f7]/50 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]"><Zap className="w-4 h-4 text-[#a855f7] animate-pulse" /></div>
                <div className="flex flex-col"><span className="text-[8px] font-black uppercase tracking-[0.1em] text-[#a855f7]/70">Knowledge</span><span className="text-sm font-mono font-bold text-[#a855f7]">{resources.forbiddenKnowledge}</span></div>
              </div>
            </div>
            <div className="pointer-events-auto flex flex-col items-end gap-2 fixed top-3 right-3 sm:relative sm:top-0 sm:right-0">
               <div className="hud-glass rounded-xl px-4 py-2 text-right">
                 <div className={`text-[10px] font-bold uppercase tracking-[2px] mb-1 ${gameInfo.timer > 90 ? 'text-hp animate-pulse' : 'text-emerald-400'}`}>
                   {gameInfo.timer <= 90 ? `Prep ends` : `Demon Lv.${gameInfo.demonLevel}`}
                 </div>
                 <div className="text-2xl font-mono font-bold tracking-tight">
                   {gameInfo.timer <= 90 ? formatTime(90 - gameInfo.timer) : formatTime(gameInfo.timer)}
                 </div>
               </div>
            </div>
          </div>

          <AnimatePresence>
            {selectedTile && (
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute bottom-0 left-0 right-0 h-[280px] sm:h-[320px] rts-panel z-40 p-0 pointer-events-auto overflow-hidden bg-black/80">
                <div className="max-w-7xl mx-auto h-full flex flex-col sm:flex-row gap-1 p-2">
                  <div className="w-full sm:w-[300px] h-[80px] sm:h-full flex flex-row sm:flex-col gap-2 shrink-0">
                    <div className="bg-[#1a140f] border-4 border-[#3d2b1f] p-2 flex-1 flex flex-row items-center justify-between text-center relative overflow-hidden">
                      <div className="flex-1 flex flex-row items-center justify-center gap-3">
                        <div className="text-3xl sm:text-6xl">{!selectedBuildingAtTile ? '👷' : selectedBuildingStats?.icon || '🏰'}</div>
                        <div className="text-left"><h3 className="text-[#fbbf24] font-black text-xs uppercase">{selectedBuildingAtTile ? selectedBuildingAtTile.getDynamicName() : (isPlayersBaseAtTile ? "BUILD" : "Unclaimed")}</h3></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                    <div className="flex items-center gap-1 px-1">
                      {!selectedBuildingAtTile ? (
                        (['defense', 'offense', 'resource', 'forbidden'] as const).map(cat => (
                          <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1 uppercase font-black text-[10px] ${activeCategory === cat ? 'bg-[#fbbf24] text-black' : 'bg-[#1a140f] text-[#8b5e3c]'}`}>{cat}</button>
                        ))
                      ) : (
                        <div className="flex gap-2"><div className="px-3 py-1 font-black uppercase text-[10px] bg-[#fbbf24] text-black">EVOLUTION</div></div>
                      )}
                    </div>
                    
                    <div className="flex-1 bg-[#1a140f] border-2 border-[#3d2b1f] p-2 flex gap-2 overflow-x-auto items-center">
                      {selectedBuildingAtTile ? (
                         <div className="flex gap-2 w-full">
                            {selectedBuildingAtTile.owner === engineRef.current?.player ? (
                              selectedBuildingStats?.upgradesTo?.map(nextType => {
                                const stats = BUILDINGS[nextType];
                                const canAfford = resources.wood >= stats.costWood && resources.gold >= stats.costGold;
                                const unlocked = isUnlocked(nextType);
                                return (
                                  <motion.button key={nextType} disabled={!canAfford || !unlocked} onClick={() => upgradeTo(nextType)} className="w-32 bg-[#2a1f18] border-2 border-[#fbbf24]/30 p-2 flex flex-col items-center hover:border-[#fbbf24] disabled:opacity-30 shrink-0">
                                    <span className="text-3xl">{stats.icon}</span>
                                    <div className="text-[10px] font-black text-[#fbbf24] uppercase mt-1">{stats.label}</div>
                                  </motion.button>
                                );
                              })
                            ) : (
                              <div className="text-center w-full text-[#8b5e3c]/50 text-xs font-black uppercase">Owned by Rival Domain</div>
                            )}
                         </div>
                      ) : (
                        categories[activeCategory as 'defense' | 'offense' | 'resource'].filter(t => isUnlocked(t)).map(type => {
                          const stats = BUILDINGS[type];
                          const canAfford = resources.wood >= stats.costWood && resources.gold >= stats.costGold;
                          return (
                            <motion.button key={type} disabled={!canAfford} onClick={(e) => { e.stopPropagation(); build(type); }} className="w-32 bg-[#2a1f18] border-2 border-[#3d2b1f] p-2 flex flex-col items-center disabled:opacity-40 shrink-0">
                              <span className="text-3xl">{stats.icon}</span>
                              <div className="text-[10px] font-black text-[#fbbf24] uppercase mt-1">{stats.label}</div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="w-[120px] flex flex-col gap-1 shrink-0">
                    <button onClick={() => setSelectedTile(null)} className="h-10 bg-[#3d1f1f] text-[#f87171] font-black uppercase text-[10px]">CLOSE</button>
                    <button disabled={!selectedBuildingAtTile || selectedBuildingAtTile.hp >= selectedBuildingAtTile.maxHp} onClick={repair} className="h-10 bg-[#1a140f] text-emerald-500 font-black uppercase text-[10px] disabled:opacity-30">Repair</button>
                    <button disabled={!selectedBuildingAtTile} onClick={sell} className="h-10 bg-[#1a140f] text-rose-500 font-black uppercase text-[10px] disabled:opacity-30">Sell</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
