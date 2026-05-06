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
  
  // Joystick State
  const [joystickStart, setJoystickStart] = useState<{ x: number, y: number } | null>(null);
  const [joystickCurrent, setJoystickCurrent] = useState<{ x: number, y: number } | null>(null);

  // Pinch Zoom State
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);

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
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(updateInterval);
    };
  }, []);

  // --- JOYSTICK LOGIC (Left Side Only) ---
  const startJoystick = (e: TouchEvent) => {
    const touch = e.touches[0];
    setJoystickStart({ x: touch.clientX, y: touch.clientY });
    setJoystickCurrent({ x: touch.clientX, y: touch.clientY });
  };

  const moveJoystick = (e: TouchEvent) => {
    if (!joystickStart || !engineRef.current) return;
    const touch = e.touches[0];
    setJoystickCurrent({ x: touch.clientX, y: touch.clientY });

    const dx = touch.clientX - joystickStart.x;
    const dy = touch.clientY - joystickStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxLen = 50;

    engineRef.current.joystick.x = dx / maxLen;
    engineRef.current.joystick.y = dy / maxLen;

    if (dist > maxLen) {
      const angle = Math.atan2(dy, dx);
      engineRef.current.joystick.x = Math.cos(angle);
      engineRef.current.joystick.y = Math.sin(angle);
    }
  };

  const endJoystick = () => {
    setJoystickStart(null);
    setJoystickCurrent(null);
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  // --- INTERACTION LOGIC (Right Side / Pinch Zoom) ---
  const handleInteractionTouch = (e: TouchEvent) => {
    if (e.touches.length === 2 && engineRef.current) {
      // Pinch Zoom Logic
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
      
      if (lastPinchDist) {
        const zoomFactor = dist / lastPinchDist;
        engineRef.current.zoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * zoomFactor));
      }
      setLastPinchDist(dist);
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
    engineRef.current._selectedTile = { x: gx, y: gy };
  };

  return (
    <div className="relative w-full h-screen bg-[#050805] overflow-hidden touch-none">
      
      {/* 1. GAME LAYER */}
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        onTouchMove={handleInteractionTouch}
        onTouchEnd={() => setLastPinchDist(null)}
        className="block w-full h-full" 
      />

      {/* 2. JOYSTICK ZONE (Transparent box on the left) */}
      <div 
        className="absolute bottom-0 left-0 w-[50%] h-[60%] z-50"
        onTouchStart={startJoystick}
        onTouchMove={moveJoystick}
        onTouchEnd={endJoystick}
      >
        <AnimatePresence>
          {joystickStart && joystickCurrent && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute pointer-events-none"
              style={{ left: joystickStart.x - 50, top: joystickStart.y - 50 }}
            >
              <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm flex items-center justify-center">
                <div 
                  className="w-10 h-10 bg-white/40 rounded-full"
                  style={{ 
                    transform: `translate(${Math.min(40, Math.max(-40, joystickCurrent.x - joystickStart.x))}px, ${Math.min(40, Math.max(-40, joystickCurrent.y - joystickStart.y))}px)` 
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. HUD (Buttons & Stats) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-4 left-4 p-4 hud-glass rounded-xl flex gap-6">
           <div className="flex flex-col"><span className="text-[#8b5e3c] font-bold text-xs">WOOD</span><span className="font-mono">{resources.wood}</span></div>
           <div className="flex flex-col"><span className="text-[#fbbf24] font-bold text-xs">GOLD</span><span className="font-mono">{resources.gold}</span></div>
           <div className="flex flex-col"><span className="text-[#f87171] font-bold text-xs">HP</span><span className="font-mono">{resources.hp}</span></div>
        </div>
      </div>

      {/* Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] pointer-events-auto">
          <h1 className="text-6xl font-black italic mb-8">WARDENS</h1>
          <button 
            className="bg-white text-black px-12 py-4 rounded-full font-bold uppercase"
            onClick={() => { setGameState(GameState.PLAYING); engineRef.current?.start(); }}
          >
            Start Journey
          </button>
        </div>
      )}
    </div>
  );
}
