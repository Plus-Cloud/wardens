import React, { useEffect, useRef, useState, MouseEvent, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Axe, Coins, Heart, Wrench, Skull, Zap, Lock, Shield 
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { GameState, BuildingType, BUILDINGS, TILE_SIZE } from './game/constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [resources, setResources] = useState({ 
    wood: 0, gold: 0, hp: 100, isLumbering: false, forbiddenKnowledge: 0 
  });
  const [gameInfo, setGameInfo] = useState({ demonLevel: 1, timer: 0 });
  const [selectedTile, setSelectedTile] = useState<{ x: number, y: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<'defense' | 'offense' | 'resource' | 'forbidden'>('defense');
  
  // Joystick State
  const [joystickStart, setJoystickStart] = useState<{ x: number, y: number } | null>(null);
  const [joystickCurrent, setJoystickCurrent] = useState<{ x: number, y: number } | null>(null);

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
        setGameInfo({
          demonLevel: engineRef.current.demon?.level || 1,
          timer: Math.floor(engineRef.current.timer),
        });
        if (engineRef.current.player.isDead) setGameState(GameState.GAMEOVER);
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(updateInterval);
      engineRef.current = null;
    };
  }, []);

  // --- MOBILE TOUCH LOGIC ---
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    // If touch is on the left half of the screen, spawn joystick
    if (touch.clientX < window.innerWidth / 2) {
      setJoystickStart({ x: touch.clientX, y: touch.clientY });
      setJoystickCurrent({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!joystickStart || !engineRef.current) return;
    const touch = e.touches[0];
    setJoystickCurrent({ x: touch.clientX, y: touch.clientY });

    const dx = touch.clientX - joystickStart.x;
    const dy = touch.clientY - joystickStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxLen = 50;

    // Update Engine Joystick
    engineRef.current.joystick.x = dx / maxLen;
    engineRef.current.joystick.y = dy / maxLen;
    
    // Clamp joystick input
    if (dist > maxLen) {
      const angle = Math.atan2(dy, dx);
      engineRef.current.joystick.x = Math.cos(angle);
      engineRef.current.joystick.y = Math.sin(angle);
    }
  };

  const handleTouchEnd = () => {
    setJoystickStart(null);
    setJoystickCurrent(null);
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  const handleCanvasClick = (e: MouseEvent) => {
    if (!engineRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / engineRef.current.zoom + engineRef.current.camera.x;
    const y = (e.clientY - rect.top) / engineRef.current.zoom + engineRef.current.camera.y;
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    setSelectedTile({ x: gx, y: gy });
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#050805] overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} onClick={handleCanvasClick} className="block w-full h-full" />

      {/* VIRTUAL JOYSTICK UI */}
      <AnimatePresence>
        {joystickStart && joystickCurrent && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute pointer-events-none z-50"
            style={{ left: joystickStart.x - 50, top: joystickStart.y - 50 }}
          >
            {/* Outer Circle */}
            <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
              {/* Stick */}
              <div 
                className="w-10 h-10 bg-white/40 rounded-full shadow-lg"
                style={{ 
                  transform: `translate(${Math.min(50, Math.max(-50, joystickCurrent.x - joystickStart.x))}px, ${Math.min(50, Math.max(-50, joystickCurrent.y - joystickStart.y))}px)` 
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD & MENU (Shortened for space, keep your original UI here) */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[100]">
          <h1 className="text-6xl font-black italic text-white mb-8">WARDENS</h1>
          <button 
            onClick={() => { setGameState(GameState.PLAYING); engineRef.current?.start(); }}
            className="bg-white text-black px-12 py-4 rounded-full font-bold uppercase"
          >
            Enter Forest
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="absolute top-4 left-4 p-4 hud-glass rounded-xl flex gap-6 pointer-events-none">
         <div className="flex flex-col"><span className="text-wood font-bold">Wood</span><span>{resources.wood}</span></div>
         <div className="flex flex-col"><span className="text-gold font-bold">Gold</span><span>{resources.gold}</span></div>
         <div className="flex flex-col"><span className="text-hp font-bold">HP</span><span>{resources.hp}</span></div>
      </div>
    </div>
  );
}
