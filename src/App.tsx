import React, { useEffect, useRef, useState, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEngine } from './game/engine';
import { GameState, TILE_SIZE } from './game/constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [resources, setResources] = useState({ wood: 0, gold: 0, hp: 100 });
  
  const [touchStart, setTouchStart] = useState<{ x: number, y: number, time: number } | null>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number, y: number } | null>(null);
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
    // Prevent UI touches (buttons) from triggering game logic
    if ((e.target as HTMLElement).closest('.hud-glass, button')) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
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
        engineRef.current.zoom = Math.max(0.6, Math.min(2.0, engineRef.current.zoom * zoomFactor));
      }
      setLastPinchDist(dist);
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      if (!engineRef.current.player.claimedBaseId) {
        // Player is free-roaming: Move player
        setJoystickPos({ x: touch.clientX, y: touch.clientY });
        const maxLen = 50;
        engineRef.current.joystick.x = Math.min(1, Math.max(-1, dx / maxLen));
        engineRef.current.joystick.y = Math.min(1, Math.max(-1, dy / maxLen));
      } else {
        // Player is docked: Pan Camera
        engineRef.current.camera.x -= (touch.clientX - touchStart.x) / engineRef.current.zoom;
        engineRef.current.camera.y -= (touch.clientY - touchStart.y) / engineRef.current.zoom;
        setTouchStart({ x: touch.clientX, y: touch.clientY, time: touchStart.time });
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!engineRef.current || !touchStart) return;

    const touch = e.changedTouches[0];
    const duration = Date.now() - touchStart.time;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // TAP LOGIC
    if (duration < 250 && distance < 15) {
      const rect = canvasRef.current!.getBoundingClientRect();
      // CORRECT GRID CALCULATION
      const worldX = (touch.clientX - rect.left) / engineRef.current.zoom + engineRef.current.camera.x;
      const worldY = (touch.clientY - rect.top) / engineRef.current.zoom + engineRef.current.camera.y;
      
      const gx = Math.floor(worldX / TILE_SIZE);
      const gy = Math.floor(worldY / TILE_SIZE);
      
      const baseId = engineRef.current.baseMap[gy]?.[gx];
      const clickedBuilding = engineRef.current.getBuildingAt(gx, gy);
      const isOwnBase = baseId && engineRef.current.player.claimedBaseId === baseId;

      // Filter: Only allow interaction with OWN base or ENEMY towers/unclaimed bases
      if (clickedBuilding || isOwnBase || (baseId && !engineRef.current.player.claimedBaseId)) {
        engineRef.current._selectedTile = { x: gx, y: gy };
        // Trigger claim if clicking an unclaimed base
        if (baseId && !engineRef.current.player.claimedBaseId) {
          engineRef.current.claimBase(engineRef.current.player, baseId);
        }
      } else {
        engineRef.current._selectedTile = null;
      }
    }

    setTouchStart(null);
    setJoystickPos(null);
    setLastPinchDist(null);
    if (engineRef.current) {
      engineRef.current.joystick.x = 0;
      engineRef.current.joystick.y = 0;
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#050805] overflow-hidden touch-none"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      <AnimatePresence>
        {touchStart && joystickPos && !engineRef.current?.player.claimedBaseId && (
          <motion.div className="absolute pointer-events-none z-50"
            style={{ left: touchStart.x - 40, top: touchStart.y - 40 }}>
            <div className="w-20 h-20 rounded-full border-2 border-white/20 bg-black/20 flex items-center justify-center">
              <div className="w-8 h-8 bg-white/40 rounded-full"
                style={{ transform: `translate(${Math.min(30, Math.max(-30, joystickPos.x - touchStart.x))}px, ${Math.min(30, Math.max(-30, joystickPos.y - touchStart.y))}px)` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* HUD components... */}
    </div>
  );
}
