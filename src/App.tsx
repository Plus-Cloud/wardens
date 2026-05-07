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

type Category = 'defense' | 'offense' | 'resource' | 'forbidden';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(
    GameState.MENU
  );

  const [resources, setResources] = useState({
    wood: 0,
    gold: 0,
    hp: 100,
    isLumbering: false,
    forbiddenKnowledge: 0,
  });

  const [selectedTile, setSelectedTile] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [gameInfo, setGameInfo] = useState({
    demonLevel: 1,
    timer: 0,
  });

  const [activeCategory, setActiveCategory] =
    useState<Category>('defense');

  const [touchStart, setTouchStart] = useState<{
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const [joystickPos, setJoystickPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [lastPinchDist, setLastPinchDist] =
    useState<number | null>(null);

  const categories: Record<Category, BuildingType[]> = {
    defense: [
      BuildingType.WOOD_WALL,
      BuildingType.REPAIR_HUT,
    ],

    resource: [
      BuildingType.LUMBER_SHACK,
      BuildingType.GOLD_MINE,
    ],

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
          forbiddenKnowledge:
            player.forbiddenKnowledge,
        };

        if (
          prev.wood === next.wood &&
          prev.gold === next.gold &&
          prev.hp === next.hp &&
          prev.isLumbering ===
            next.isLumbering &&
          prev.forbiddenKnowledge ===
            next.forbiddenKnowledge
        ) {
          return prev;
        }

        return next;
      });

      setGameInfo(prev => {
        const next = {
          demonLevel:
            engineRef.current?.demon?.level || 1,
          timer: Math.floor(
            engineRef.current?.timer || 0
          ),
        };

        if (
          prev.demonLevel === next.demonLevel &&
          prev.timer === next.timer
        ) {
          return prev;
        }

        return next;
      });

      if (player.isDead) {
        setGameState(GameState.GAMEOVER);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        'resize',
        resize
      );
    };
  }, []);

  const handleTouchStart = (
    e: TouchEvent
  ) => {
    const target = e.target as HTMLElement;

    if (
      target.closest('button') ||
      target.closest('.rts-panel') ||
      target.closest('[data-ui]')
    ) {
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];

      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      });

      setLastPinchDist(null);
    }

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      setLastPinchDist(
        Math.hypot(
          t1.clientX - t2.clientX,
          t1.clientY - t2.clientY
        )
      );

      setTouchStart(null);
      setJoystickPos(null);
    }
  };

  const handleTouchMove = (
    e: TouchEvent
  ) => {
    if (!engineRef.current) return;

    if (
      e.touches.length === 2 &&
      lastPinchDist !== null
    ) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY
      );

      const zoomFactor =
        dist / lastPinchDist;

      engineRef.current.zoom = Math.max(
        0.6,
        Math.min(
          2,
          engineRef.current.zoom *
            zoomFactor
        )
      );

      setLastPinchDist(dist);

      return;
    }

    if (
      e.touches.length === 1 &&
      touchStart
    ) {
      const touch = e.touches[0];

      const dx =
        touch.clientX - touchStart.x;

      const dy =
        touch.clientY - touchStart.y;

      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        if (
          !engineRef.current.player
            .claimedBaseId
        ) {
          setJoystickPos({
            x: touch.clientX,
            y: touch.clientY,
          });

          engineRef.current.joystick.x =
            Math.max(
              -1,
              Math.min(1, dx / 50)
            );

          engineRef.current.joystick.y =
            Math.max(
              -1,
              Math.min(1, dy / 50)
            );
        } else {
          const sensitivity =
            1 / engineRef.current.zoom;

          engineRef.current.camera.x -=
            dx * sensitivity;

          engineRef.current.camera.y -=
            dy * sensitivity;

          setTouchStart({
            x: touch.clientX,
            y: touch.clientY,
            time: touchStart.time,
          });
        }
      }
    }
  };

  const handleTouchEnd = (
    e: TouchEvent
  ) => {
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }

    setJoystickPos(null);

    if (
      e.changedTouches.length === 1 &&
      touchStart
    ) {
      const touch =
        e.changedTouches[0];

      const duration =
        Date.now() - touchStart.time;

      const dist = Math.hypot(
        touch.clientX - touchStart.x,
        touch.clientY - touchStart.y
      );

      if (
        duration < 300 &&
        dist < 15
      ) {
        const rect =
          canvasRef.current!.getBoundingClientRect();

        const zoom =
          engineRef.current!.zoom;

        const x =
          (touch.clientX - rect.left) /
            zoom +
          engineRef.current!.camera.x;

        const y =
          (touch.clientY - rect.top) /
            zoom +
          engineRef.current!.camera.y;

        const gx = Math.floor(
          x / TILE_SIZE
        );

        const gy = Math.floor(
          y / TILE_SIZE
        );

        setSelectedTile({
          x: gx,
          y: gy,
        });

        engineRef.current!._selectedTile =
          {
            x: gx,
            y: gy,
          };
      }
    }

    setTouchStart(null);
  };

  const handleWheel = (
    e: WheelEvent
  ) => {
    if (!engineRef.current) return;

    const zoomSpeed = 0.1;

    const delta =
      e.deltaY > 0
        ? 1 - zoomSpeed
        : 1 + zoomSpeed;

    engineRef.current.zoom = Math.max(
      0.6,
      Math.min(
        2,
        engineRef.current.zoom *
          delta
      )
    );
  };

  const isUnlocked = (
    type: BuildingType
  ) => {
    if (
      [
        BuildingType.WOOD_WALL,
        BuildingType.GUARD_TOWER,
        BuildingType.GOLD_MINE,
        BuildingType.REPAIR_HUT,
        BuildingType.LUMBER_SHACK,
      ].includes(type)
    ) {
      return true;
    }

    return engineRef.current?.player.unlockedBuildings.has(
      type as any
    );
  };

  const build = (
    type: BuildingType
  ) => {
    if (
      !selectedTile ||
      !engineRef.current
    ) {
      return;
    }

    engineRef.current.tryPlaceBuilding(
      selectedTile.x,
      selectedTile.y,
      type
    );
  };

  const repair = () => {
    if (
      !selectedTile ||
      !engineRef.current
    ) {
      return;
    }

    const building =
      engineRef.current.getBuildingAt(
        selectedTile.x,
        selectedTile.y
      );

    if (building) {
      engineRef.current.repairBuilding(
        building
      );
    }
  };

  const sell = () => {
    if (
      !selectedTile ||
      !engineRef.current
    ) {
      return;
    }

    const building =
      engineRef.current.getBuildingAt(
        selectedTile.x,
        selectedTile.y
      );

    if (building) {
      engineRef.current.sellBuilding(
        building
      );

      setSelectedTile(null);

      engineRef.current._selectedTile =
        null;
    }
  };

  const upgradeTo = (
    newType: BuildingType
  ) => {
    if (
      !selectedTile ||
      !engineRef.current
    ) {
      return;
    }

    const building =
      engineRef.current.getBuildingAt(
        selectedTile.x,
        selectedTile.y
      );

    if (!building) return;

    const stats =
      BUILDINGS[newType];

    const player =
      engineRef.current.player;

    if (
      player.wood >= stats.costWood &&
      player.gold >= stats.costGold
    ) {
      player.wood -= stats.costWood;
      player.gold -= stats.costGold;

      building.evolve(newType);
    }
  };

  const formatTime = (
    seconds: number
  ) => {
    const mins = Math.floor(
      seconds / 60
    );

    const secs = seconds % 60;

    return `${mins}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const selectedBuildingAtTile =
    selectedTile &&
    engineRef.current?.getBuildingAt(
      selectedTile.x,
      selectedTile.y
    );

  const selectedBuildingStats =
    selectedBuildingAtTile
      ? BUILDINGS[
          selectedBuildingAtTile.type
        ]
      : null;

  return (
    <div
      data-ui
      className="relative w-full h-screen overflow-hidden bg-[#050805] text-gray-100 touch-none select-none"
      style={{
        WebkitTapHighlightColor:
          'transparent',
        overscrollBehavior: 'none',
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      <AnimatePresence>
        {touchStart &&
          joystickPos &&
          !engineRef.current?.player
            .claimedBaseId && (
            <motion.div
              className="absolute z-50 pointer-events-none"
              style={{
                left:
                  touchStart.x - 50,
                top:
                  touchStart.y - 50,
              }}
            >
              <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                <div
                  className="w-10 h-10 rounded-full bg-white/40"
                  style={{
                    transform: `translate(${Math.min(
                      50,
                      Math.max(
                        -50,
                        joystickPos.x -
                          touchStart.x
                      )
                    )}px, ${Math.min(
                      50,
                      Math.max(
                        -50,
                        joystickPos.y -
                          touchStart.y
                      )
                    )}px)`,
                  }}
                />
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState ===
          GameState.MENU && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f0a]/90 backdrop-blur-md p-6 text-center"
          >
            <h1 className="text-6xl sm:text-8xl font-black tracking-[-4px] italic uppercase">
              WARDENS
            </h1>

            <p className="mt-2 mb-10 text-xs tracking-[4px] uppercase text-gray-400">
              Defend the clearings.
              Survive the night.
            </p>

            <button
              onClick={() => {
                setGameState(
                  GameState.PLAYING
                );

                engineRef.current?.start();
              }}
              className="rounded-full bg-white px-10 py-4 text-black font-bold uppercase active:scale-95 transition-transform"
            >
              Enter Forest
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState ===
        GameState.PLAYING && (
        <>
          <div className="absolute top-0 left-0 right-0 z-20 flex justify-between p-3 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap gap-2">
              <div className="flex gap-3 rounded-xl bg-black/50 backdrop-blur-md p-3 border border-white/10">
                <div>
                  <div className="text-[10px] uppercase text-gray-500">
                    Wood
                  </div>

                  <div className="flex items-center gap-1">
                    <Axe className="w-4 h-4 text-orange-400" />

                    <span className="font-bold">
                      {resources.wood}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase text-gray-500">
                    Gold
                  </div>

                  <div className="flex items-center gap-1">
                    <Coins className="w-4 h-4 text-yellow-400" />

                    <span className="font-bold">
                      {resources.gold}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase text-gray-500">
                    HP
                  </div>

                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4 text-red-400" />

                    <span className="font-bold">
                      {resources.hp}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-black/50 backdrop-blur-md p-3 border border-purple-500/20">
                <Zap className="w-4 h-4 text-purple-400" />

                <span className="font-bold text-purple-300">
                  {
                    resources.forbiddenKnowledge
                  }
                </span>
              </div>
            </div>

            <div className="pointer-events-auto rounded-xl bg-black/50 backdrop-blur-md p-3 border border-white/10 text-right">
              <div className="text-[10px] uppercase tracking-wider text-gray-400">
                Demon Lv.
                {
                  gameInfo.demonLevel
                }
              </div>

              <div className="text-2xl font-bold">
                {formatTime(
                  gameInfo.timer
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {selectedTile && (
              <motion.div
                initial={{
                  y: '100%',
                }}
                animate={{
                  y: 0,
                }}
                exit={{
                  y: '100%',
                }}
                transition={{
                  type: 'spring',
                  damping: 24,
                }}
                className="
                absolute
                bottom-0
                left-0
                right-0
                z-40
                max-h-[85vh]
                min-h-[260px]
                overflow-hidden
                border-t
                border-[#3d2b1f]
                bg-black/90
                backdrop-blur-md
                pb-[env(safe-area-inset-bottom)]
                rts-panel
              "
              >
                <div className="w-14 h-1.5 rounded-full bg-white/20 mx-auto mt-2 mb-2" />

                <div
                  className="
                  h-full
                  overflow-y-auto
                  p-2
                "
                >
                  <div
                    className="
                    flex
                    flex-col
                    gap-2
                    lg:flex-row
                  "
                  >
                    <div
                      className="
                      flex
                      items-center
                      gap-3
                      border
                      border-[#3d2b1f]
                      bg-[#1a140f]
                      p-3
                      rounded-lg
                      lg:w-[280px]
                    "
                    >
                      <div className="text-5xl">
                        {!selectedBuildingAtTile
                          ? '👷'
                          : selectedBuildingStats?.icon}
                      </div>

                      <div>
                        <div className="text-xs uppercase text-[#fbbf24] font-black">
                          {selectedBuildingAtTile
                            ? selectedBuildingAtTile.getDynamicName()
                            : 'Build'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
                        {(
                          Object.keys(
                            categories
                          ) as Category[]
                        ).map(cat => (
                          <button
                            key={cat}
                            onClick={() =>
                              setActiveCategory(
                                cat
                              )
                            }
                            className={`
                            px-3
                            py-2
                            rounded-md
                            uppercase
                            text-[10px]
                            font-black
                            whitespace-nowrap
                            transition-all
                            ${
                              activeCategory ===
                              cat
                                ? 'bg-[#fbbf24] text-black'
                                : 'bg-[#1a140f] text-[#8b5e3c]'
                            }
                          `}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div
                        className="
                        flex
                        gap-2
                        overflow-x-auto
                        overflow-y-hidden
                        pb-2
                        scrollbar-thin
                      "
                      >
                        {selectedBuildingAtTile
                          ? selectedBuildingStats?.upgradesTo?.map(
                              nextType => {
                                const stats =
                                  BUILDINGS[
                                    nextType
                                  ];

                                const canAfford =
                                  resources.wood >=
                                    stats.costWood &&
                                  resources.gold >=
                                    stats.costGold;

                                return (
                                  <button
                                    key={
                                      nextType
                                    }
                                    onClick={() =>
                                      upgradeTo(
                                        nextType
                                      )
                                    }
                                    disabled={
                                      !canAfford
                                    }
                                    className={`
                                    relative
                                    min-w-[120px]
                                    rounded-lg
                                    border-2
                                    p-3
                                    transition-all
                                    active:scale-95
                                    ${
                                      canAfford
                                        ? 'border-[#fbbf24]/40 bg-[#2a1f18]'
                                        : 'border-red-900 bg-[#2a1f18]/50 opacity-50'
                                    }
                                  `}
                                  >
                                    <div className="text-4xl">
                                      {
                                        stats.icon
                                      }
                                    </div>

                                    <div className="mt-2 text-[10px] uppercase font-black text-[#fbbf24]">
                                      {
                                        stats.label
                                      }
                                    </div>
                                  </button>
                                );
                              }
                            )
                          : categories[
                              activeCategory
                            ]
                              .filter(
                                t =>
                                  isUnlocked(
                                    t
                                  )
                              )
                              .map(type => {
                                const stats =
                                  BUILDINGS[
                                    type
                                  ];

                                const canAfford =
                                  resources.wood >=
                                    stats.costWood &&
                                  resources.gold >=
                                    stats.costGold;

                                const unlocked =
                                  isUnlocked(
                                    type
                                  );

                                return (
                                  <button
                                    key={type}
                                    onClick={() =>
                                      build(
                                        type
                                      )
                                    }
                                    disabled={
                                      !canAfford
                                    }
                                    className={`
                                    relative
                                    min-w-[120px]
                                    rounded-lg
                                    border-2
                                    p-3
                                    transition-all
                                    active:scale-95
                                    ${
                                      canAfford
                                        ? 'border-[#3d2b1f] bg-[#2a1f18]'
                                        : 'border-red-900 bg-[#2a1f18]/50 opacity-50'
                                    }
                                  `}
                                  >
                                    {!unlocked && (
                                      <div className="absolute inset-0 rounded-lg bg-black/80 flex items-center justify-center">
                                        <Lock className="w-5 h-5 text-red-500" />
                                      </div>
                                    )}

                                    <div className="text-4xl">
                                      {
                                        stats.icon
                                      }
                                    </div>

                                    <div className="mt-2 text-[10px] uppercase font-black text-[#fbbf24]">
                                      {
                                        stats.label
                                      }
                                    </div>

                                    <div className="mt-2 text-[10px] space-y-1">
                                      <div
                                        className={
                                          resources.wood >=
                                          stats.costWood
                                            ? 'text-emerald-400'
                                            : 'text-red-500'
                                        }
                                      >
                                        🪵{' '}
                                        {
                                          stats.costWood
                                        }
                                      </div>

                                      <div
                                        className={
                                          resources.gold >=
                                          stats.costGold
                                            ? 'text-yellow-400'
                                            : 'text-red-500'
                                        }
                                      >
                                        🪙{' '}
                                        {
                                          stats.costGold
                                        }
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                      </div>
                    </div>

                    <div className="flex gap-2 lg:flex-col lg:w-[120px]">
                      <button
                        onClick={() =>
                          setSelectedTile(
                            null
                          )
                        }
                        className="flex-1 rounded-lg bg-red-950 px-3 py-3 text-xs font-black uppercase text-red-300"
                      >
                        Close
                      </button>

                      <button
                        onClick={repair}
                        className="flex-1 rounded-lg bg-emerald-950 px-3 py-3 text-xs font-black uppercase text-emerald-300"
                      >
                        Repair
                      </button>

                      <button
                        onClick={sell}
                        className="flex-1 rounded-lg bg-rose-950 px-3 py-3 text-xs font-black uppercase text-rose-300"
                      >
                        Sell
                      </button>
                    </div>
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
