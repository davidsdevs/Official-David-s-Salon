import { useEffect } from 'react';
import { useToasterStore } from 'react-hot-toast';

let audioContext;
let unlocked = false;
const firedToastIds = new Set();

const isSoundEnabled = () => {
  try {
    const v = window.localStorage.getItem('toastSoundEnabled');
    if (v === null) return true;
    return v !== 'false';
  } catch {
    return true;
  }
};

const getAudioContext = () => {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContext = new Ctx();
  return audioContext;
};

const tryUnlockAudio = async () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  unlocked = ctx.state === 'running';
};

const playToastBeep = async (toastType) => {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (!unlocked) {
    await tryUnlockAudio();
  }

  if (ctx.state !== 'running') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const type = toastType || 'default';

  let frequency = 523.25;
  let durationMs = 90;

  if (type === 'error') {
    frequency = 196.0;
    durationMs = 140;
  } else if (type === 'success') {
    frequency = 659.25;
    durationMs = 90;
  } else if (type === 'loading') {
    frequency = 440.0;
    durationMs = 70;
  }

  const now = ctx.currentTime;
  const duration = durationMs / 1000;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
};

const ToastSound = () => {
  const { toasts } = useToasterStore();

  useEffect(() => {
    const onFirstInteraction = () => {
      tryUnlockAudio();
    };

    window.addEventListener('pointerdown', onFirstInteraction, { passive: true });
    window.addEventListener('keydown', onFirstInteraction);

    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    for (const t of toasts) {
      if (!t?.id) continue;
      if (firedToastIds.has(t.id)) continue;
      if (t.visible === false) continue;

      firedToastIds.add(t.id);
      playToastBeep(t.type);
    }
  }, [toasts]);

  return null;
};

export default ToastSound;
