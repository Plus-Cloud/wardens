import React, { useEffect, useRef, useState, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEngine } from './game/engine';
import { GameState, TILE_SIZE } from './game/constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [resources, setResources] = useState({ wood: 0, gold: 0, hp: 100 });
  
  // Input States
  const [touchStart, setTouchStart] = useState<{ x: number, y: number, time: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number, y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const [isMovingCamera, setIsMovingCamera] = useState(false);

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
    
    const interval = setInterval(() => {
      if (engineRef.current) {
        setResources({
          wood: Math.floor(engineRef.current.player.wood),
          gold: Math.floor(engineRef.current.player.gold),
          hp: Math.floor(engineRef.current.player.hp),
        });
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    setIsMovingCamera(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!engineRef.current || !touchStart) return;

    // 1. PINCH ZOOM
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

    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 2. JOYSTICK vs CAMERA PAN
    if (distance > 10) {
      if (!engineRef.current.player.claimedBaseId) {
        // Not docked: Dragging moves the player (Joystick)
        setJoystickPos({ x: touch.clientX, y: touch.clientY });
        const maxLen = 50;
        engineRef.current.joystick.x = Math.min(1, Math.max(-1, dx / maxLen));
        engineRef.current.joystick.y = Math.min(1, Math.max(-1, dy / maxLen));
      } else {
        // Docked: Dragging moves the CAMERA
        setIsMovingCamera(true);
        engineRef.current.camera.x -= dx / engineRef.current.zoom;
        engineRef.current.camera.y -= dy / engineRef.current.zoom;
        setTouchStart({ x: touch.clientX, y: touch.clientY, time: touchStart.time }); // Update start to current for smooth pan
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    const duration = Date.now() - (touchStart?.time || 0);
    const dx = touch.clientX - (touchStart?.x || 0);
    const dy = touch.clientY - (touchStart?.y || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 3. TAP TO BUILD (If it was a quick touch with almost no movement)
    if (duration < 200 && distance < 15) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / engineRef.current!.zoom + engineRef.current!.camera.x;
      const y = (touch.clientY - rect.top) / engineRef.current!.zoom + engineRef.current!.camera.y;
      const gx = Math.floor(x / TILE_SIZE);
      const gy = Math.floor(y / TILE_SIZE);
      
      engineRef.current!._selectedTile = { x: gx, y: gy };
      // Trigger your build/shop logic here
    }

    // Reset everything
    setTouchStart(null);
    setJoystickPos(null);
    setLastPinchDist(null);
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-[#050805] overflow-hidden touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Visual Joystick (Only if moving player) */}
      <AnimatePresence>
        {touchStart && joystickPos && !engineRef.current?.player.claimedBaseId && (
          <motion.div 
            className="absolute pointer-events-none z-50"
            style={{ left: touchStart.x - 40, top: touchStart.y - 40 }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-white/20 bg-black/20 backdrop-blur-sm flex items-center justify-center">
              <div 
                className="w-8 h-8 bg-white/40 rounded-full"
                style={{ 
                  transform: `translate(${Math.min(30, Math.max(-30, joystickPos.x - touchStart.x))}px, ${Math.min(30, Math.max(-30, joystickPos.y - touchStart.y))}px)` 
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <div className="absolute top-4 left-4 p-4 hud-glass rounded-xl flex gap-6 pointer-events-none">
         <div className="flex flex-col text-wood font-bold"><span>WOOD</span><span>{resources.wood}</span></div>
         <div className="flex flex-col text-gold font-bold"><span>GOLD</span><span>{resources.gold}</span></div>
         <div className="flex flex-col text-hp font-bold"><span>HP</span><span>{resources.hp}</span></div>
      </div>

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-[100]">
          <h1 className="text-5xl font-black italic mb-8">WARDENS</h1>
          <button 
            className="bg-white text-black px-12 py-3 rounded-full font-bold uppercase"
            onClick={() => { setGameState(GameState.PLAYING); engineRef.current?.start(); }}
          >
            Play
          </button>
        </div>
      )}
    </div>
  );
}
