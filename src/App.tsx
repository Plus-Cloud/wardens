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
  
  // Interaction State
  const [joystickStart, setJoystickStart] = useState<{ x: number, y: number } | null>(null);
  const [joystickCurrent, setJoystickCurrent] = useState<{ x: number, y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // --- MASTER TOUCH CONTROLLER ---
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(false);

    if (e.touches.length === 1) {
      // LEFT SIDE = Joystick | RIGHT SIDE = Pan/Interaction
      if (touch.clientX < window.innerWidth / 2) {
        setJoystickStart({ x: touch.clientX, y: touch.clientY });
        setJoystickCurrent({ x: touch.clientX, y: touch.clientY });
      } else {
        // Prepare for panning
        setIsDragging(true);
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!engineRef.current) return;

    // 1. PINCH ZOOM (Two Fingers)
    if (e.touches.length === 2) {
      const dist = Math.sqrt(
        Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + 
        Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
      );
      if (lastPinchDist) {
        const zoomFactor = dist / lastPinchDist;
        engineRef.current.zoom = Math.max(0.5, Math.min(2.5, engineRef.current.zoom * zoomFactor));
      }
      setLastPinchDist(dist);
      return;
    }

    // 2. JOYSTICK (Left Side)
    if (joystickStart) {
      const touch = e.touches[0];
      setJoystickCurrent({ x: touch.clientX, y: touch.clientY });
      const dx = touch.clientX - joystickStart.x;
      const dy = touch.clientY - joystickStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxLen = 50;
      
      engineRef.current.joystick.x = dx / maxLen;
      engineRef.current.joystick.y = dy / maxLen;
      
      if (dist > 5) setIsDragging(true); // Treat small joystick movement as dragging to prevent accidental taps
    }

    // 3. CAMERA PAN (Right Side)
    if (!joystickStart && e.touches.length === 1) {
      // Logic for panning if you aren't using the joystick
      // This is handled by your engine's internal isPanning if you want, 
      // but let's keep the joystick and taps primary for now.
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isDragging && !joystickStart && e.changedTouches.length === 1) {
      // This was a clean TAP - trigger click
      handleManualClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }

    setJoystickStart(null);
    setJoystickCurrent(null);
    setLastPinchDist(null);
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  const handleManualClick = (clientX: number, clientY: number) => {
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / engineRef.current.zoom + engineRef.current.camera.x;
    const y = (clientY - rect.top) / engineRef.current.zoom + engineRef.current.camera.y;
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    
    setSelectedTile({ x: gx, y: gy });
    engineRef.current._selectedTile = { x: gx, y: gy };
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#050805] overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Visual Joystick */}
      <AnimatePresence>
        {joystickStart && joystickCurrent && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute pointer-events-none z-50"
            style={{ left: joystickStart.x - 50, top: joystickStart.y - 50 }}
          >
            <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-sm flex items-center justify-center">
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

      {/* Stats Bar */}
      <div className="absolute top-4 left-4 p-4 hud-glass rounded-xl flex gap-6 pointer-events-none z-10">
         <div className="flex flex-col"><span className="text-[#8b5e3c] font-bold text-[10px]">WOOD</span><span className="font-mono">{resources.wood}</span></div>
         <div className="flex flex-col"><span className="text-[#fbbf24] font-bold text-[10px]">GOLD</span><span className="font-mono">{resources.gold}</span></div>
         <div className="flex flex-col"><span className="text-[#f87171] font-bold text-[10px]">HP</span><span className="font-mono">{resources.hp}</span></div>
      </div>

      {/* Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100]">
          <h1 className="text-6xl font-black italic mb-8">WARDENS</h1>
          <button 
            className="bg-white text-black px-12 py-4 rounded-full font-bold uppercase pointer-events-auto"
            onClick={() => { setGameState(GameState.PLAYING); engineRef.current?.start(); }}
          >
            Start
          </button>
        </div>
      )}
    </div>
  );
}
