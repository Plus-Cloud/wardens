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

    return () => window.removeEventListener('resize', resize);
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

    if (e.touches.length === 1 && engineRef.current) {
      const t = e.touches[0];
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (t.clientX - rect.left) / (engineRef.current.zoom || 1) + (engineRef.current.camera?.x || 0);
      const y = (t.clientY - rect.top) / (engineRef.current.zoom || 1) + (engineRef.current.camera?.y || 0);

      const gx = Math.floor(x / TILE_SIZE);
      const gy = Math.floor(y / TILE_SIZE);
      
      setSelectedTile({ x: gx, y: gy });
      engineRef.current._selectedTile = { x: gx, y: gy };
    }
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

  return (
    <div
      className="w-full h-screen overflow-hidden bg-black text-white touch-none"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
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

      {/* COMPACT SHOP UI */}
      <AnimatePresence>
        {selectedTile && gameState === GameState.PLAYING && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 h-[220px] bg-black/95 border-t-4 border-[#3d2b1f] flex flex-col rts-panel z-40"
          >
            {/* Tabs */}
            <div className="flex bg-[#1a140f] border-b border-[#3d2b1f] shrink-0">
              {(Object.keys(categories) as Category[]).map((cat) => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)} 
                  className={`flex-1 py-3 text-[10px] uppercase font-black tracking-widest transition-colors ${activeCategory === cat ? 'bg-[#fbbf24] text-black' : 'text-[#8b5e3c] hover:bg-[#2a1f18]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Shop Content */}
            <div className="flex-1 flex p-2 gap-2 overflow-hidden">
              {/* Horizontal Scroll Area for Buildings */}
              <div className="flex-1 flex gap-2 overflow-x-auto items-center pb-2">
                {categories[activeCategory].map((type) => {
                  const stats = BUILDINGS[type];
                  return (
                    <button 
                      key={type} 
                      onClick={() => build(type)} 
                      className="w-24 h-24 bg-[#2a1f18] border-2 border-[#3d2b1f] flex flex-col items-center justify-center shrink-0 transition-colors hover:border-[#fbbf24]"
                    >
                      <div className="text-4xl mb-1">{stats.icon}</div>
                      <div className="text-[10px] font-black text-[#fbbf24] uppercase text-center px-1 leading-tight">{stats.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="w-[80px] flex flex-col gap-2 shrink-0">
                <button 
                  onClick={() => { setSelectedTile(null); if(engineRef.current) engineRef.current._selectedTile = null; }} 
                  className="flex-1 bg-red-900/30 border border-red-900/50 text-red-500 font-black text-[10px] uppercase hover:bg-red-900 hover:text-red-100"
                >
                  Close
                </button>
                <button 
                  onClick={repair} 
                  className="flex-1 bg-green-900/30 border border-green-900/50 text-green-500 font-black text-[10px] uppercase hover:bg-green-900 hover:text-green-100"
                >
                  Repair
                </button>
                <button 
                  onClick={sell} 
                  className="flex-1 bg-purple-900/30 border border-purple-900/50 text-purple-500 font-black text-[10px] uppercase hover:bg-purple-900 hover:text-purple-100"
                >
                  Sell
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
