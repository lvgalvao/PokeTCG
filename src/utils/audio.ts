export const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export function playFlipSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  // A short "thwip" sound for card flip
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
  
  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

export function playCelebrationSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const startTime = audioCtx.currentTime;

  // 1. Play a magical/celebratory arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    const t = startTime + i * 0.12;
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.05);
    
    const duration = i === 3 ? 1.0 : 0.15; // Last note rings out
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + duration);
  });

  // 2. Play synthesized "applause" (filtered noise with spikes)
  const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // White noise base
    let noise = (Math.random() * 2 - 1) * 0.15;
    // Add random louder "claps"
    if (Math.random() > 0.99) {
      noise += (Math.random() * 2 - 1) * 0.8;
    }
    data[i] = noise;
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.5;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.6, startTime + 0.2); // fade in applause
  noiseGain.gain.setValueAtTime(0.6, startTime + 1.2);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 2.0); // fade out

  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);

  noiseSource.start(startTime);
}

/** Rasgo do lacre: ruído com filtro em varredura, curto e seco. */
export function playTearSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  const length = Math.floor(audioCtx.sampleRate * 0.28);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Fibras rasgando: ruído com estalos irregulares.
    data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.97 ? 1 : 0.35);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(4200, t + 0.22);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(t);
}
