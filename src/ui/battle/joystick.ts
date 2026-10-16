import { el } from '../../utils/dom.js';

/** Prende o dedo ao controle, para o gesto continuar valendo fora dele. */
export function capturePointer(target: Element, pointerId: number): void {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Ponteiro que já sumiu: o controle segue funcionando sem a captura.
  }
}

/**
 * Alavanca de toque: `x` para a direita e `y` para cima, cada um em [-1, 1]. Cada alavanca
 * captura o próprio dedo, então as duas funcionam ao mesmo tempo.
 */
export class Joystick {
  readonly root: HTMLElement;
  x = 0;
  y = 0;
  private readonly knob: HTMLElement;
  private pointerId: number | null = null;

  constructor(className: string, label: string) {
    this.knob = el('span', { className: 'stick__knob' });
    this.root = el('div', {
      className: `stick ${className}`,
      attrs: { role: 'application', 'aria-label': label },
      children: [this.knob],
    });
    this.root.addEventListener('pointerdown', (ev) => {
      if (this.pointerId !== null) return;
      this.pointerId = ev.pointerId;
      capturePointer(this.root, ev.pointerId);
      this.root.classList.add('is-active');
      this.track(ev);
      ev.preventDefault();
    });
    this.root.addEventListener('pointermove', (ev) => {
      if (ev.pointerId === this.pointerId) this.track(ev);
    });
    const release = (ev: PointerEvent) => {
      if (ev.pointerId === this.pointerId) this.reset();
    };
    this.root.addEventListener('pointerup', release);
    this.root.addEventListener('pointercancel', release);
    this.root.addEventListener('lostpointercapture', release);
  }

  reset(): void {
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.root.classList.remove('is-active');
    this.knob.style.transform = '';
  }

  private track(ev: PointerEvent): void {
    const rect = this.root.getBoundingClientRect();
    const reach = rect.width / 2;
    let dx = (ev.clientX - (rect.left + reach)) / reach;
    let dy = (ev.clientY - (rect.top + reach)) / reach;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.x = dx;
    this.y = -dy;
    const travel = reach * 0.55;
    this.knob.style.transform = `translate(${dx * travel}px, ${dy * travel}px)`;
  }
}
