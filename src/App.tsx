import React, { useEffect, useRef, useState, TouchEvent, WheelEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEngine } from './game/engine';
import { GameState, BuildingType, BUILDINGS, TILE_SIZE } from './game/constants';

type Category = 'defense' | 'offense' | 'resource' | 'forbidden';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState(GameState.MENU);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('defense');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tick, setTick] = useState(0);

  const [touchStart, setTouchStart] = useState<{ x: number, y: number, time: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number, y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);

  const categories: Record<Category, BuildingType[]> = {
    defense: [BuildingType.WOOD_WALL, BuildingType.REPAIR_HUT],
    resource: [BuildingType.LUMBER_SHACK, BuildingType.GOLD_MINE],
    offense: [BuildingType.GUARD_TOWER],
    forbidden: [
      BuildingType.SOULGUARD_TOWER, BuildingType.SIEGE_CANNON, BuildingType.SUPPLY_NODE,
      BuildingType.VOID_COLLECTOR, BuildingType.ESSENCE_DISTILLER, BuildingType.ABYSSAL_SPIRE,
    ],
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    try {
      engineRef.current = new GameEngine(canvas);
    } catch (err: any) {
      setErrorMsg(err.message || 'Engine failed to initialize on load.');
    }

    const interval = setInterval(() => setTick(t => t + 1), 100);

    return () => {
      window.removeEventListener('resize', resize);
      clearInterval(interval);
    };
  }, []);

  const startGame = () => {
    try {
      engineRef.current?.start();
      setGameState(GameState.PLAYING);
    } catch (e: any) {
      setErrorMsg(e.message || 'Engine failed to start loop.');
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.rts-panel')) return;

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

      if (dist > 10) { 
        if (!engineRef.current.player.claimedBaseId) {
          setJoystickPos({ x: touch.clientX, y: touch.clientY });
          engineRef.current.joystick.x = Math.max(-1, Math.min(1, dx / 50));
          engineRef.current.joystick.y = Math.max(-1, Math.min(1, dy / 50));
        } else {
          engineRef.current.camera.x -= dx / engineRef.current.zoom;
          engineRef.current.camera.y -= dy / engineRef.current.zoom;
          setTouchStart({ x: touch.clientX, y: touch.clientY, time: touchStart.time });
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

      if (duration < 300 && dist < 15) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const zoom = engineRef.current!.zoom || 1;
        const x = (touch.clientX - rect.left) / zoom + (engineRef.current!.camera.x || 0);
        const y = (touch.clientY - rect.top) / zoom + (engineRef.current!.camera.y || 0);
        
        const gx = Math.floor(x / TILE_SIZE);
        const gy = Math.floor(y / TILE_SIZE);
        
        setSelectedTile({ x: gx, y: gy });
        engineRef.current!._selectedTile = { x: gx, y: gy };
      }
    }
    setTouchStart(null);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!engineRef.current) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    engineRef.current.zoom = Math.max(0.6, Math.min(2, engineRef.current.zoom * delta));
  };

  const build = (type: BuildingType) => {
    if (selectedTile && engineRef.current) {
      engineRef.current.tryPlaceBuilding(selectedTile.x, selectedTile.y, type);
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
          if (engineRef.current.checkFKMilestones) {
             engineRef.current.checkFKMilestones(player, building);
          }
        }
      }
    }
  };

  const repair = () => {
    if (selectedTile && engineRef.current) {
      const b = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (b) engineRef.current.repairBuilding(b);
    }
  };

  const sell = () => {
    if (selectedTile && engineRef.current) {
      const b = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
      if (b) {
        engineRef.current.sellBuilding(b);
        setSelectedTile(null);
        engineRef.current._selectedTile = null;
      }
    }
  };

  const selectedBuildingAtTile = selectedTile && engineRef.current ? engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y) : null;
  const selectedBuildingStats = selectedBuildingAtTile ? BUILDINGS[selectedBuildingAtTile.type as BuildingType] : null;

  return (
    <div
      className="w-full h-screen overflow-hidden bg-black text-white touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {errorMsg ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 z-[200] p-6 text-center">
          <p className="text-xl font-bold font-mono">CRITICAL ERROR: <br/> {errorMsg}</p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
      )}

      <AnimatePresence>
        {touchStart && joystickPos && !engineRef.current?.player.claimedBaseId && (
          <motion.div 
            className="absolute pointer-events-none z-50"
            style={{ left: touchStart.x - 50, top: touchStart.y - 50 }}
          >
            <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
              <div 
                className="w-10 h-10 bg-white/40 rounded-full shadow-lg"
                style={{ transform: `translate(${Math.min(50, Math.max(-50, joystickPos.x - touchStart.x))}px, ${Math.min(50, Math.max(-50, joystickPos.y - touchStart.y))}px)` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState === GameState.MENU && !errorMsg && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <h1 className="text-6xl font-black mb-6 italic tracking-tight">WARDENS</h1>
            <button onClick={startGame} className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full">
              Enter Forest
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTile && gameState === GameState.PLAYING && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 h-[260px] bg-black/95 border-t-4 border-[#3d2b1f] flex flex-col rts-panel z-40"
          >
            <div className="flex bg-[#1a140f] border-b border-[#3d2b1f] shrink-0 items-center h-10">
              {selectedBuildingAtTile ? (
                <div className="flex-1 px-4 flex justify-between items-center text-[#fbbf24] font-black uppercase text-xs tracking-widest">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedBuildingStats?.icon}</span>
                    <span>{selectedBuildingStats?.label}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <span>HP: {Math.floor(selectedBuildingAtTile.hp)} / {selectedBuildingAtTile.maxHp}</span>
                  </div>
                </div>
              ) : (
                (Object.keys(categories) as Category[]).map((cat) => (
                  <button 
                    key={cat} onClick={() => setActiveCategory(cat)} 
                    className={`flex-1 h-full text-[10px] uppercase font-black tracking-widest transition-colors ${activeCategory === cat ? 'bg-[#fbbf24] text-black' : 'text-[#8b5e3c] hover:bg-[#2a1f18]'}`}
                  >
                    {cat}
                  </button>
                ))
              )}
            </div>

            <div className="flex-1 flex p-2 gap-2 overflow-hidden">
              <div className="flex-1 flex gap-2 overflow-x-auto items-stretch pb-1">
                {selectedBuildingAtTile ? (
                  selectedBuildingStats?.upgradesTo?.length ? (
                    selectedBuildingStats.upgradesTo.map((nextType) => {
                      const stats = BUILDINGS[nextType];
                      const canAfford = engineRef.current!.player.wood >= stats.costWood && engineRef.current!.player.gold >= stats.costGold;
                      return (
                        <button 
                          key={nextType} onClick={() => upgradeTo(nextType)} disabled={!canAfford}
                          className="w-36 bg-[#2a1f18] border-2 border-[#3d2b1f] flex flex-col items-center justify-start shrink-0 transition-colors hover:border-[#fbbf24] disabled:opacity-30 p-2"
                        >
                          <div className="text-3xl mb-1">{stats.icon}</div>
                          <div className="text-[10px] font-black text-[#fbbf24] uppercase text-center leading-tight mb-1 line-clamp-1">{stats.label}</div>
                          <div className="flex gap-2 text-[10px] font-bold mb-2">
                            <span className="text-[#8b5e3c]">W:{stats.costWood}</span>
                            <span className="text-[#fbbf24]">G:{stats.costGold}</span>
                          </div>
                          <div className="text-[9px] text-gray-400 text-center leading-tight overflow-hidden line-clamp-3">
                            {stats.description || 'Upgrades this structure.'}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="w-full flex items-center justify-center text-[#8b5e3c] font-black uppercase tracking-widest text-sm opacity-50">
                      Max Level Reached
                    </div>
                  )
                ) : (
                  categories[activeCategory].map((type) => {
                    const stats = BUILDINGS[type];
                    const canAfford = engineRef.current!.player.wood >= stats.costWood && engineRef.current!.player.gold >= stats.costGold;
                    return (
                      <button 
                        key={type} onClick={() => build(type)} disabled={!canAfford}
                        className="w-36 bg-[#2a1f18] border-2 border-[#3d2b1f] flex flex-col items-center justify-start shrink-0 transition-colors hover:border-[#fbbf24] disabled:opacity-30 p-2"
                      >
                        <div className="text-3xl mb-1">{stats.icon}</div>
                        <div className="text-[10px] font-black text-[#fbbf24] uppercase text-center leading-tight mb-1 line-clamp-1">{stats.label}</div>
                        <div className="flex gap-2 text-[10px] font-bold mb-2">
                          <span className="text-[#8b5e3c]">W:{stats.costWood}</span>
                          <span className="text-[#fbbf24]">G:{stats.costGold}</span>
                        </div>
                        <div className="text-[9px] text-gray-400 text-center leading-tight overflow-hidden line-clamp-3">
                          {stats.description || 'A vital structure.'}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="w-[80px] flex flex-col gap-2 shrink-0">
                <button onClick={() => { setSelectedTile(null); if(engineRef.current) engineRef.current._selectedTile = null; }} className="flex-1 bg-red-900/30 border border-red-900/50 text-red-500 font-black text-[10px] uppercase hover:bg-red-900 hover:text-red-100">Close</button>
                <button onClick={repair} disabled={!selectedBuildingAtTile} className="flex-1 bg-green-900/30 border border-green-900/50 text-green-500 font-black text-[10px] uppercase hover:bg-green-900 hover:text-green-100 disabled:opacity-20">Repair</button>
                <button onClick={sell} disabled={!selectedBuildingAtTile} className="flex-1 bg-purple-900/30 border border-purple-900/50 text-purple-500 font-black text-[10px] uppercase hover:bg-purple-900 hover:text-purple-100 disabled:opacity-20">Sell</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
