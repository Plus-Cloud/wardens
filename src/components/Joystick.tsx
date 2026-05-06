import { useRef, useState, TouchEvent, MouseEvent } from 'react';

interface JoystickProps {
  onMove: (data: { x: number; y: number }) => void;
  onEnd: () => void;
}

export function Joystick({ onMove, onEnd }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const handleTouch = (e: TouchEvent | MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const dx = clientX - (rect.left + centerX);
    const dy = clientY - (rect.top + centerY);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = rect.width / 2;
    
    const limitedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * limitedDist;
    const ny = Math.sin(angle) * limitedDist;

    setKnobPos({ x: nx, y: ny });
    onMove({ x: nx / maxDist, y: ny / maxDist });
  };

  const handleEnd = () => {
    setKnobPos({ x: 0, y: 0 });
    onEnd();
  };

  return (
    <div 
      ref={containerRef}
      className="w-40 h-40 bg-white/5 backdrop-blur-md rounded-full border-2 border-white/10 relative touch-none"
      onTouchMove={handleTouch}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => {
        const move = (me: MouseEvent) => handleTouch(me as any);
        const up = () => {
          handleEnd();
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        handleTouch(e);
      }}
    >
      <div 
        className="w-[60px] h-[60px] bg-white/20 border-2 border-white/40 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        style={{ transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))` }}
      />
    </div>
  );
}
