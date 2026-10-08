/**
 * Movimento no estilo "Designing Fluid Interfaces" (WWDC 2018): molas parametrizadas por
 * amortecimento (damping ratio) e resposta (segundos), que partem do valor atual e herdam a
 * velocidade do gesto — por isso são interrompíveis.
 */

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SpringOptions {
  /** 1 = criticamente amortecida (sem overshoot); < 1 = quica. */
  readonly damping?: number;
  /** Rapidez em segundos (não é duração). */
  readonly response?: number;
  /** Velocidade inicial em unidades/s (a do dedo ao soltar). */
  readonly velocity?: number;
}

/** Anima um número de `from` até `to`. Retorna uma função que cancela. */
export function spring(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  { damping = 1, response = 0.35, velocity = 0 }: SpringOptions = {},
  onDone?: () => void,
): () => void {
  if (prefersReducedMotion()) {
    onUpdate(to);
    onDone?.();
    return () => {};
  }
  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  let x = from;
  let v = velocity;
  let last = performance.now();
  let raf = 0;
  const step = (now: number) => {
    let dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const a = -stiffness * (x - to) - friction * v;
      v += a * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < 0.01 && Math.abs(v) < 0.05) {
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Histórico curto de posições para calcular a velocidade de soltura (px/s). */
export class VelocityTracker {
  private samples: Array<{ x: number; y: number; t: number }> = [];

  reset(): void {
    this.samples = [];
  }

  add(x: number, y: number): void {
    const t = performance.now();
    this.samples.push({ x, y, t });
    while (this.samples.length > 1 && t - this.samples[0]!.t > 100) this.samples.shift();
  }

  velocity(): { vx: number; vy: number } {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || last.t === first.t) return { vx: 0, vy: 0 };
    const dt = (last.t - first.t) / 1000;
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  }
}

/** Projeção de momento da Apple: onde um arremesso pararia (desaceleração exponencial). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistência progressiva além de um limite. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Brilho holográfico + leve inclinação 3D que seguem o ponteiro. Escreve --mx/--my (%) e
 * --rx/--ry (graus) no elemento; a classe `.foil` desenha o reflexo.
 */
export function attachFoil(el: HTMLElement, maxTilt = 10): () => void {
  el.classList.add('foil');
  const move = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const px = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
    const py = Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    if (!prefersReducedMotion()) {
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * maxTilt}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 2 * maxTilt}deg`);
    }
    el.classList.add('is-foil-active');
  };
  const leave = () => {
    el.classList.remove('is-foil-active');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  };
}
