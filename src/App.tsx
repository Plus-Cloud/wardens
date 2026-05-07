import React, {
  useEffect,
  useRef,
  useState,
  TouchEvent,
  WheelEvent,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import {
  Axe,
  Coins,
  Heart,
  Zap,
  Lock,
} from 'lucide-react';

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

  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);

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

  // ENGINE INIT
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    const resize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const interval = setInterval(() => {
      if (!engineRef.current) return;

      const player = engineRef.current.player;

      setResources(prev => {
        const next = {
          wood: Math.floor(player.wood),
          gold: Math.floor(player.gold),
          hp: Math.floor(player.hp),
          isLumbering: player.isLumbering,
          forbiddenKnowledge: player.forbiddenKnowledge,
        };

        if (
          prev.wood === next.wood &&
          prev.gold === next.gold &&
          prev.hp === next.hp &&
          prev.isLumbering === next.isLumbering &&
          prev.forbiddenKnowledge === next.forbiddenKnowledge
        ) {
          return prev;
        }

        return next;
      });

      setGameInfo({
        demonLevel: engineRef.current?.demon?.level || 1,
        timer: Math.floor(engineRef.current?.timer || 0),
      });

      if (player.isDead) setGameState(GameState.GAMEOVER);
    }, 100);

    return () => {
      window.removeEventListener('resize', resize);
      clearInterval(interval);
    };
  }, []);

  // TOUCH START
  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;

    if (
      target.closest('button') ||
      target.closest('.rts-panel') ||
      target.closest('[data-ui]')
    ) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      setTouchStart({ x: t.clientX, y: t.clientY, time: Date.now() });
    }

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      setLastPinchDist(Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY));
      setTouchStart(null);
    }
  };

  // TOUCH MOVE
  const handleTouchMove = (e: TouchEvent) => {
    if (!engineRef.current) return;

    // pinch zoom
    if (e.touches.length === 2 && lastPinchDist) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const zoomFactor = dist / lastPinchDist;

      engineRef.current.zoom = Math.max(0.6, Math.min(2, engineRef.current.zoom * zoomFactor));
      setLastPinchDist(dist);
      return;
    }

    // drag
    if (e.touches.length === 1 && touchStart) {
      const t = e.touches[0];

      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;

      if (!engineRef.current.player.claimedBaseId) {
        setJoystickPos({ x: t.clientX, y: t.clientY });

        engineRef.current.joystick.x = Math.max(-1, Math.min(1, dx / 50));
        engineRef.current.joystick.y = Math.max(-1, Math.min(1, dy / 50));
      } else {
        const s = 1 / engineRef.current.zoom;
        engineRef.current.camera.x -= dx * s;
        engineRef.current.camera.y -= dy * s;
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }

    setJoystickPos(null);
    setTouchStart(null);
  };

  const handleWheel = (e: WheelEvent) => {
    if (!engineRef.current) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    engineRef.current.zoom = Math.max(0.6, Math.min(2, engineRef.current.zoom * delta));
  };

  const isUnlocked = (type: BuildingType) =>
    Object.values(categories).flat().includes(type);

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

  const upgradeTo = (type: BuildingType) => {
    if (!selectedTile || !engineRef.current) return;

    const b = engineRef.current.getBuildingAt(selectedTile.x, selectedTile.y);
    if (!b) return;

    const stats = BUILDINGS[type];
    const p = engineRef.current.player;

    if (p.wood >= stats.costWood && p.gold >= stats.costGold) {
      p.wood -= stats.costWood;
      p.gold -= stats.costGold;
      b.evolve(type);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const selectedBuildingAtTile =
    selectedTile &&
    engineRef.current?.getBuildingAt(selectedTile.x, selectedTile.y);

  const selectedBuildingStats =
    selectedBuildingAtTile ? BUILDINGS[selectedBuildingAtTile.type] : null;

  return (
    <div
      data-ui
      className="relative w-full h-screen overflow-hidden bg-[#050805] text-white select-none touch-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* HUD */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-0 left-0 right-0 flex justify-between p-3 z-20">
          <div className="flex gap-3 bg-black/50 p-3 rounded-xl">
            <span>🪵 {resources.wood}</span>
            <span>🪙 {resources.gold}</span>
            <span>❤️ {resources.hp}</span>
            <span>⚡ {resources.forbiddenKnowledge}</span>
          </div>
          <div className="bg-black/50 p-3 rounded-xl">
            Lv {gameInfo.demonLevel} | {formatTime(gameInfo.timer)}
          </div>
        </div>
      )}

      {/* BOTTOM MENU FIXED */}
      <AnimatePresence>
        {selectedTile && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26 }}
            className="
              absolute bottom-0 left-0 right-0 z-40
              h-[85vh] sm:h-[420px]
              bg-black/95
              border-t border-[#3d2b1f]
              flex flex-col
              pb-[env(safe-area-inset-bottom)]
              rts-panel
            "
          >
            {/* HANDLE */}
            <div className="w-14 h-1.5 bg-white/20 rounded-full mx-auto mt-2" />

            <div className="flex flex-col flex-1 p-2 gap-2">
              
              {/* TABS */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(categories).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat as Category)}
                    className={`px-3 py-2 rounded-md text-[10px] font-black uppercase ${
                      activeCategory === cat
                        ? 'bg-yellow-400 text-black'
                        : 'bg-[#1a140f]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* GRID (FIXED) */}
              <div className="flex flex-wrap gap-2 overflow-y-auto">
                {categories[activeCategory].map(type => {
                  const stats = BUILDINGS[type];

                  return (
                    <button
                      key={type}
                      onClick={() => build(type)}
                      className="
                        w-[48%] sm:w-[140px]
                        bg-[#2a1f18]
                        p-3
                        rounded-lg
                        border
                        active:scale-95
                      "
                    >
                      <div className="text-3xl">{stats.icon}</div>
                      <div className="text-[10px] font-bold">
                        {stats.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2">
                <button onClick={() => setSelectedTile(null)} className="flex-1 bg-red-900 p-2 rounded">
                  Close
                </button>
                <button onClick={repair} className="flex-1 bg-green-900 p-2 rounded">
                  Repair
                </button>
                <button onClick={sell} className="flex-1 bg-rose-900 p-2 rounded">
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
