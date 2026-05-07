import React, {
  useEffect,
  useRef,
  useState,
  TouchEvent,
  WheelEvent,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { Axe, Coins, Heart, Zap } from 'lucide-react';

import { GameEngine } from './game/engine';
import {
  GameState,
  BuildingType,
  BUILDINGS,
  TILE_SIZE,
} from './game/constants';

type Category =
  | 'defense'
  | 'offense'
  | 'resource'
  | 'forbidden';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [gameState, setGameState] = useState(GameState.MENU);

  const [resources, setResources] = useState({
    wood: 0,
    gold: 0,
    hp: 100,
    isLumbering: false,
    forbiddenKnowledge: 0,
  });

  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);

  const [gameInfo, setGameInfo] = useState({
    demonLevel: 1,
    timer: 0,
  });

  const [activeCategory, setActiveCategory] = useState<Category>('defense');

  const categories: Record<Category, BuildingType[]> = {
    defense: [BuildingType.WOOD_WALL, BuildingType.REPAIR_HUT],
    resource: [BuildingType.LUMBER_SHACK, BuildingType.GOLD_MINE],
    offense: [BuildingType.GUARD_TOWER],
    forbidden: [
      BuildingType.SOULGUARD_TOWER,
      BuildingType.SIEGE_CANNON,
      BuildingType.SUPPLY_NODE,
      BuildingType.VOID_COLLECTOR,
      BuildingType.ESSENCE_DISTILLER,
      BuildingType.ABYSSAL_SPIRE,
    ],
  };

  // -------------------------
  // ENGINE BOOT (SAFE)
  // -------------------------
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();

    window.addEventListener('resize', resize);

    let engine: GameEngine | null = null;

    try {
      engine = new GameEngine(canvas);
      engineRef.current = engine;
    } catch (err) {
      console.error('ENGINE FAILED TO INIT', err);
    }

    // fallback render loop so BLACK SCREEN NEVER HAPPENS
    const loop = () => {
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!engineRef.current) {
          ctx.fillStyle = 'white';
          ctx.fillText('Engine failed to load', 20, 40);
        } else {
          // safety render call if engine exists
          engineRef.current.update?.(0.016);
          engineRef.current.render?.(ctx);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -------------------------
  // START GAME
  // -------------------------
  const startGame = () => {
    setGameState(GameState.PLAYING);

    if (!engineRef.current) return;

    try {
      engineRef.current.start?.();
    } catch (e) {
      console.error('ENGINE START FAILED', e);
    }
  };

  // -------------------------
  // TOUCH HANDLING (SAFE)
  // -------------------------
  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;

    if (
      target.closest('button') ||
      target.closest('.rts-panel')
    ) return;

    if (e.touches.length === 1 && engineRef.current) {
      const t = e.touches[0];

      const rect = canvasRef.current!.getBoundingClientRect();

      const x =
        (t.clientX - rect.left) / (engineRef.current.zoom || 1) +
        (engineRef.current.camera?.x || 0);

      const y =
        (t.clientY - rect.top) / (engineRef.current.zoom || 1) +
        (engineRef.current.camera?.y || 0);

      setSelectedTile({
        x: Math.floor(x / TILE_SIZE),
        y: Math.floor(y / TILE_SIZE),
      });
    }
  };

  const handleTouchMove = (_e: TouchEvent) => {};

  const handleTouchEnd = () => {};

  const handleWheel = (e: WheelEvent) => {
    if (!engineRef.current) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    engineRef.current.zoom = Math.max(
      0.6,
      Math.min(2, engineRef.current.zoom * delta)
    );
  };

  // -------------------------
  // BUILD ACTIONS
  // -------------------------
  const build = (type: BuildingType) => {
    if (!selectedTile || !engineRef.current) return;
    engineRef.current.tryPlaceBuilding(selectedTile.x, selectedTile.y, type);
  };

  const repair = () => {
    if (!selectedTile || !engineRef.current) return;
    const b = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
    if (b) engineRef.current.repairBuilding(b);
  };

  const sell = () => {
    if (!selectedTile || !engineRef.current) return;
    const b = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
    if (b) {
      engineRef.current.sellBuilding(b);
      setSelectedTile(null);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div
      className="w-full h-screen overflow-hidden bg-black text-white"
      data-ui
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* MENU */}
      <AnimatePresence>
        {gameState === GameState.MENU && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h1 className="text-6xl font-black mb-6">WARDENS</h1>

            <button
              onClick={startGame}
              className="px-8 py-4 bg-white text-black font-bold rounded-full"
            >
              Enter Forest
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM MENU (SAFE VERSION) */}
      <AnimatePresence>
        {selectedTile && gameState === GameState.PLAYING && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="
              absolute bottom-0 left-0 right-0
              h-[60vh] sm:h-[400px]
              bg-black/95
              border-t border-gray-800
              p-2
              flex flex-col
              rts-panel
            "
          >
            <div className="flex gap-2 flex-wrap mb-2">
              {Object.keys(categories).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as Category)}
                  className="px-3 py-1 bg-gray-800 rounded text-xs"
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 flex-1 overflow-y-auto">
              {categories[activeCategory].map((type) => {
                const stats = BUILDINGS[type];

                return (
                  <button
                    key={type}
                    onClick={() => build(type)}
                    className="w-[48%] sm:w-[140px] bg-gray-900 p-3 rounded"
                  >
                    <div className="text-2xl">{stats.icon}</div>
                    <div className="text-xs">{stats.label}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={() => setSelectedTile(null)} className="flex-1 bg-red-900 p-2">
                Close
              </button>
              <button onClick={repair} className="flex-1 bg-green-900 p-2">
                Repair
              </button>
              <button onClick={sell} className="flex-1 bg-purple-900 p-2">
                Sell
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
