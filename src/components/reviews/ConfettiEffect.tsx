import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface ConfettiEffectProps {
  visible: boolean;
}

const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ visible }) => {
  useEffect(() => {
    if (!visible) return;

    // Primary burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff3131', '#ffd700', '#ffffff']
    });

    // Secondary burst for extra celebration
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }, [visible]);

  return null; // Canvas overlay managed by library
};

export default ConfettiEffect;
