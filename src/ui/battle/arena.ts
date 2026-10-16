import * as THREE from 'three';
import { hitFor, type Fighter, type Move } from '../../battle/fighter.js';
import type { RNG } from '../../core/rng.js';
import { audioCtx } from '../../utils/audio.js';
import { el } from '../../utils/dom.js';
import { capturePointer, Joystick } from './joystick.js';
import { typeColor } from './type-colors.js';

export interface ArenaDeps {
  readonly root: HTMLElement;
  readonly team: readonly Fighter[];
  readonly opponents: readonly Fighter[];
  /** Decide tudo o que é sorte na luta (movimentos e mira do adversário). */
  readonly rng: RNG;
  /** Seed da batalha, mostrada no fim para reproduzir uma luta. */
  readonly seed: number;
  readonly onExit: () => void;
  readonly onRematch: () => void;
}

type Side = 'me' | 'foe';

// Medidas em "blocos" (≈ metros). A carta em pé tem 1,26 × 1,76.
const ARENA_RADIUS = 22;
const BODY_RADIUS = 0.7;
const BODY_HEIGHT = 2.6;
const CHEST = 1.6;
const PLAYER_SPEED = 7;
const FOE_SPEED = 4.2;
const GRAVITY = 30;
const JUMP_SPEED = 13;
const CAMERA_DISTANCE = 8.5;
const KO_SECONDS = 1.4;
const ENTER_SECONDS = 1.1;
const SWAP_COOLDOWN = 4;
/** O adversário ataca mais devagar que o jogador: é um jogo para a família. */
const FOE_COOLDOWN_FACTOR = 1.5;

interface Obstacle {
  readonly x: number;
  readonly z: number;
  readonly hw: number;
  readonly hd: number;
  readonly h: number;
}

/** Caixotes (dá para subir pulando) e pilares (só cobertura). */
const OBSTACLES: readonly Obstacle[] = [
  { x: -7, z: 0, hw: 1.2, hd: 1.2, h: 1.6 },
  { x: 7, z: 0, hw: 1.2, hd: 1.2, h: 1.6 },
  { x: 0, z: -4.5, hw: 1.6, hd: 0.9, h: 1.6 },
  { x: 0, z: 4.5, hw: 1.6, hd: 0.9, h: 1.6 },
  { x: -12, z: -10, hw: 0.9, hd: 0.9, h: 4.5 },
  { x: 12, z: 10, hw: 0.9, hd: 0.9, h: 4.5 },
  { x: 12, z: -10, hw: 0.9, hd: 0.9, h: 4.5 },
  { x: -12, z: 10, hw: 0.9, hd: 0.9, h: 4.5 },
];

const HURT = new THREE.Color('#ff3b30');

/** Boneco de blocos: a carta é o corpo, com braços e pernas na cor do tipo. */
class FighterModel {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly tinted: { mat: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial; base: THREE.Color }[] = [];

  constructor(fighter: Fighter, face: THREE.Texture) {
    this.group.rotation.order = 'YXZ';
    const color = new THREE.Color(typeColor(fighter.type));
    const skin = this.material(new THREE.MeshLambertMaterial({ color }));
    const dark = this.material(new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.62) }));
    // A arte aparece dos dois lados: a câmera fica atrás do jogador e ele vê a própria carta.
    const art = this.material(new THREE.MeshBasicMaterial({ map: face }));
    this.body = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.76, 0.16), [skin, skin, skin, skin, art, art]);
    this.body.position.y = 0.75 + 0.88;
    this.legL = this.limb(0.34, 0.75, 0.34, dark, -0.3, 0.75);
    this.legR = this.limb(0.34, 0.75, 0.34, dark, 0.3, 0.75);
    this.armL = this.limb(0.26, 0.85, 0.26, skin, -0.78, 2.3);
    this.armR = this.limb(0.26, 0.85, 0.26, skin, 0.78, 2.3);
    this.group.add(this.body, this.legL, this.legR, this.armL, this.armR);
  }

  private material<T extends THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>(mat: T): T {
    this.tinted.push({ mat, base: mat.color.clone() });
    return mat;
  }

  /** Membro que gira pelo topo (quadril ou ombro). */
  private limb(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    pivot.add(mesh);
    return pivot;
  }

  /** `stride` 0–1 (parado → correndo), `phase` da passada, `punch` 0–1 do golpe. */
  pose(stride: number, phase: number, punch: number, airborne: boolean): void {
    const swing = airborne ? 0.5 : Math.sin(phase) * 0.9 * stride;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = airborne ? -2.6 : -swing;
    this.armR.rotation.x = airborne ? -2.6 : swing - punch * 1.9;
    this.body.position.y = 1.63 + Math.abs(Math.sin(phase)) * 0.07 * stride;
  }

  flash(amount: number): void {
    for (const { mat, base } of this.tinted) mat.color.copy(base).lerp(HURT, amount);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const { mat } of this.tinted) mat.dispose();
  }
}

interface Actor {
  readonly side: Side;
  readonly team: readonly Fighter[];
  readonly hp: number[];
  active: number;
  model: FighterModel;
  readonly shadow: THREE.Mesh;
  readonly pos: THREE.Vector3;
  /** Velocidade do último quadro no chão (x, z) e vertical (y). */
  readonly vel: THREE.Vector3;
  readonly knock: THREE.Vector2;
  facing: number;
  onGround: boolean;
  basicIn: number;
  specialIn: number;
  swapIn: number;
  phase: number;
  stride: number;
  punch: number;
  flash: number;
  state: 'entering' | 'fighting' | 'ko';
  stateT: number;
}

interface Projectile {
  readonly mesh: THREE.Mesh;
  readonly vel: THREE.Vector3;
  readonly from: Side;
  readonly move: Move;
  readonly attackerType: string;
  readonly radius: number;
  life: number;
  /** O adversário decide uma única vez se tenta pular este golpe. */
  dodgeRolled: boolean;
}

interface Burst {
  readonly mesh: THREE.Mesh;
  t: number;
}

interface Hud {
  readonly name: HTMLElement;
  readonly bar: HTMLElement;
  readonly num: HTMLElement;
  readonly slots: HTMLElement[];
}

function tone(freq: number, seconds: number, type: OscillatorType, gain: number, slideTo?: number): void {
  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + seconds);
  } catch {
    // Sem áudio (navegador bloqueou): a luta segue muda.
  }
}

/** Arena 3D da batalha: três Pokémon de cada lado, um em campo por vez. */
export class BattleArena {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200);
  private readonly loader = new THREE.TextureLoader();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly me: Actor;
  private readonly foe: Actor;
  private readonly projectiles: Projectile[] = [];
  private readonly bursts: Burst[] = [];
  private readonly moveStick = new Joystick('stick--move', 'Andar');
  private readonly lookStick = new Joystick('stick--look', 'Girar a câmera');
  private readonly keys = new Set<string>();
  private readonly portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  private readonly hudMe: Hud;
  private readonly hudFoe: Hud;
  private readonly attackBtn: HTMLButtonElement;
  private readonly specialBtn: HTMLButtonElement;
  private readonly banner: HTMLElement;
  private readonly floats: HTMLElement;
  private readonly foeTag: HTMLElement;
  private readonly cleanups: (() => void)[] = [];
  private readonly tmp = new THREE.Vector3();
  private camYaw = Math.PI;
  private camPitch = 0.42;
  private attackHeld = false;
  private specialHeld = false;
  private jumpQueued = false;
  private ended = false;
  private alive = true;
  private last = performance.now();
  private raf = 0;
  private bannerTimer = 0;
  // Cérebro do adversário.
  private aiTimer = 0;
  private aiStrafe = 1;
  private aiRange = 9;
  private aiFireIn = 1;

  constructor(private readonly deps: ArenaDeps) {
    const { root } = deps;
    root.replaceChildren();

    const canvas = el('canvas', { className: 'arena__canvas', attrs: { 'aria-label': 'Arena de batalha' } });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.buildWorld();

    this.me = this.createActor('me', deps.team, new THREE.Vector3(0, 0, 9), Math.PI);
    this.foe = this.createActor('foe', deps.opponents, new THREE.Vector3(0, 0, -9), 0);

    // ── Interface por cima do canvas ──
    this.hudMe = this.buildHud('me');
    this.hudFoe = this.buildHud('foe');
    this.banner = el('p', { className: 'arena__banner', attrs: { role: 'status' } });
    this.floats = el('div', { className: 'arena__floats', attrs: { 'aria-hidden': 'true' } });
    this.foeTag = el('div', { className: 'arena__tag', attrs: { 'aria-hidden': 'true' }, children: [el('i')] });
    this.attackBtn = this.actionButton('arena__btn--attack', () => (this.attackHeld = true), () => (this.attackHeld = false));
    this.specialBtn = this.actionButton('arena__btn--special', () => (this.specialHeld = true), () => (this.specialHeld = false));
    const jumpBtn = this.actionButton('arena__btn--jump', () => (this.jumpQueued = true), () => undefined);
    jumpBtn.append(el('strong', { text: 'Pulo' }));
    const exit = el('button', { className: 'arena__exit', attrs: { type: 'button' }, text: 'Sair' });
    exit.addEventListener('click', () => deps.onExit());
    const rotate = el('div', {
      className: 'arena__rotate',
      children: [
        el('span', { className: 'arena__rotate-icon', attrs: { 'aria-hidden': 'true' } }),
        el('strong', { text: 'Vire o celular de lado' }),
        el('small', { text: 'A batalha é jogada com a tela deitada.' }),
      ],
    });
    root.append(
      canvas,
      this.floats,
      this.foeTag,
      this.hudMe.name.parentElement!,
      this.hudFoe.name.parentElement!,
      exit,
      this.banner,
      this.moveStick.root,
      this.lookStick.root,
      this.attackBtn,
      this.specialBtn,
      jumpBtn,
      rotate,
    );

    this.bindInput(canvas);
    const resize = new ResizeObserver(() => this.resize());
    resize.observe(root);
    this.cleanups.push(() => resize.disconnect());
    this.resize();

    this.refreshActive(this.me);
    this.refreshActive(this.foe);
    this.say(`Vai, ${this.fighter(this.me).card.name}!`);
    void audioCtx.resume().catch(() => undefined);
    console.info(`[batalha] seed 0x${deps.seed.toString(16)}`);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.bannerTimer);
    for (const fn of this.cleanups) fn();
    this.me.model.dispose();
    this.foe.model.dispose();
    for (const tex of this.textures.values()) tex.dispose();
    this.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    this.deps.root.replaceChildren();
  }

  // ── Cenário ─────────────────────────────────────────────────────────────────────

  private buildWorld(): void {
    const sky = new THREE.Color('#8fd3ff');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 45, 120);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f5a', 1.9));
    const sun = new THREE.DirectionalLight('#fff4d6', 1.6);
    sun.position.set(12, 20, 8);
    this.scene.add(sun);

    // Ilha flutuante com piso quadriculado, no estilo "baseplate".
    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    const g = tile.getContext('2d')!;
    g.fillStyle = '#5db14f';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#55a548';
    g.fillRect(0, 0, 32, 32);
    g.fillRect(32, 32, 32, 32);
    const grass = new THREE.CanvasTexture(tile);
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(ARENA_RADIUS / 2, ARENA_RADIUS / 2);
    grass.magFilter = THREE.NearestFilter;
    grass.colorSpace = THREE.SRGBColorSpace;
    const island = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS - 3, 5, 48), [
      new THREE.MeshLambertMaterial({ color: '#8a5a3c' }),
      new THREE.MeshLambertMaterial({ map: grass }),
      new THREE.MeshLambertMaterial({ color: '#6e452c' }),
    ]);
    island.position.y = -2.5;
    this.scene.add(island);

    // Mureta de blocos marcando a borda.
    const rimMat = new THREE.MeshLambertMaterial({ color: '#e9ecef' });
    const rimGeo = new THREE.BoxGeometry(1.5, 0.7, 0.7);
    const blocks = 64;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      const block = new THREE.Mesh(rimGeo, rimMat);
      block.position.set(Math.sin(a) * (ARENA_RADIUS - 0.2), 0.35, Math.cos(a) * (ARENA_RADIUS - 0.2));
      block.rotation.y = a;
      if (i % 2) block.scale.y = 1.6;
      this.scene.add(block);
    }

    const crate = new THREE.MeshLambertMaterial({ color: '#d9a441' });
    const pillar = new THREE.MeshLambertMaterial({ color: '#9aa5b1' });
    for (const o of OBSTACLES) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.hw * 2, o.h, o.hd * 2), o.h > 2 ? pillar : crate);
      mesh.position.set(o.x, o.h / 2, o.z);
      this.scene.add(mesh);
    }

    const cloud = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const clouds: readonly (readonly [number, number, number, number])[] = [
      [-30, 22, -40, 12], [18, 26, -55, 16], [45, 20, -10, 10], [-50, 24, 15, 14], [10, 28, 50, 18], [-20, 21, 45, 9],
    ];
    for (const [x, y, z, size] of clouds) {
      const m = new THREE.Mesh(cloudGeo, cloud);
      m.position.set(x, y, z);
      m.scale.set(size, 2.2, size * 0.6);
      this.scene.add(m);
    }
  }

  private texture(fighter: Fighter): THREE.Texture {
    let tex = this.textures.get(fighter.card.id);
    if (!tex) {
      tex = this.loader.load(fighter.card.imageUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.textures.set(fighter.card.id, tex);
    }
    return tex;
  }

  private createActor(side: Side, team: readonly Fighter[], pos: THREE.Vector3, facing: number): Actor {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);
    const model = new FighterModel(team[0]!, this.texture(team[0]!));
    this.scene.add(model.group);
    return {
      side,
      team,
      hp: team.map((f) => f.hp),
      active: 0,
      model,
      shadow,
      pos,
      vel: new THREE.Vector3(),
      knock: new THREE.Vector2(),
      facing,
      onGround: true,
      basicIn: 0,
      specialIn: 0,
      swapIn: 0,
      phase: 0,
      stride: 0,
      punch: 0,
      flash: 0,
      state: 'entering',
      stateT: 0,
    };
  }

  private fighter(a: Actor): Fighter {
    return a.team[a.active]!;
  }

  private other(a: Actor): Actor {
    return a === this.me ? this.foe : this.me;
  }

  // ── Interface ───────────────────────────────────────────────────────────────────

  private buildHud(side: Side): Hud {
    const actor = side === 'me' ? this.me : this.foe;
    const name = el('strong', { className: 'arena__name' });
    const bar = el('i');
    const num = el('span', { className: 'arena__hpnum' });
    const slots = actor.team.map((f, i) => {
      const slot = el(side === 'me' ? 'button' : 'span', {
        className: 'arena__slot',
        children: [el('img', { attrs: { src: f.card.imageUrl, alt: '' } }), el('i')],
      });
      if (side === 'me') {
        slot.setAttribute('type', 'button');
        slot.setAttribute('aria-label', `Trocar para ${f.card.name}`);
        slot.addEventListener('click', () => this.swapTo(i));
      }
      return slot;
    });
    el('div', {
      className: `arena__hud arena__hud--${side}`,
      children: [
        name,
        el('div', { className: 'arena__hp', children: [bar] }),
        num,
        el('div', { className: 'arena__team', children: slots }),
      ],
    });
    return { name, bar, num, slots };
  }

  private actionButton(className: string, press: () => void, release: () => void): HTMLButtonElement {
    const btn = el('button', { className: `arena__btn ${className}`, attrs: { type: 'button' } });
    btn.addEventListener('pointerdown', (ev) => {
      capturePointer(btn, ev.pointerId);
      btn.classList.add('is-pressed');
      press();
      ev.preventDefault();
    });
    const up = () => {
      btn.classList.remove('is-pressed');
      release();
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
    return btn;
  }

  /** Atualiza nome, botões de golpe e destaque do time quando o Pokémon em campo muda. */
  private refreshActive(a: Actor): void {
    const f = this.fighter(a);
    const hud = a === this.me ? this.hudMe : this.hudFoe;
    hud.name.textContent = f.card.name;
    hud.slots.forEach((slot, i) => slot.classList.toggle('is-active', i === a.active));
    if (a !== this.me) return;
    const label = (btn: HTMLElement, move: Move) =>
      btn.replaceChildren(el('strong', { text: String(move.damage) }), el('small', { text: move.name }));
    label(this.attackBtn, f.basic);
    this.attackBtn.style.setProperty('--type', typeColor(f.type));
    this.specialBtn.hidden = !f.special;
    if (f.special) label(this.specialBtn, f.special);
  }

  private say(text: string, ms = 1600): void {
    this.banner.textContent = text;
    this.banner.classList.add('is-on');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('is-on'), ms);
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    const down = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) ev.preventDefault();
      if (k === ' ' && !ev.repeat) this.jumpQueued = true;
      if (!ev.repeat && ['1', '2', '3'].includes(k)) this.swapTo(Number(k) - 1);
      this.keys.add(k);
    };
    const up = (ev: KeyboardEvent) => this.keys.delete(ev.key.toLowerCase());
    const blur = () => this.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    this.cleanups.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    });

    // Arrastar na área livre também gira a câmera (mouse no computador, dedo no celular).
    let drag: { id: number; x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (ev) => {
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      capturePointer(canvas, ev.pointerId);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!drag || drag.id !== ev.pointerId) return;
      this.turnCamera(-(ev.clientX - drag.x) * 0.006, (ev.clientY - drag.y) * 0.004);
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    });
    const end = (ev: PointerEvent) => {
      if (drag?.id === ev.pointerId) drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private turnCamera(yaw: number, pitch: number): void {
    this.camYaw += yaw;
    this.camPitch = Math.min(1.25, Math.max(0.08, this.camPitch + pitch));
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.deps.root;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── Laço do jogo ────────────────────────────────────────────────────────────────

  private frame(now: number): void {
    if (!this.alive) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const paused = this.portrait.matches || document.visibilityState !== 'visible';
    if (!paused) this.update(dt);
    this.render();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number): void {
    this.updateCamera(dt);
    this.controlPlayer();
    this.controlFoe(dt);
    this.separate();
    for (const a of [this.me, this.foe]) this.updateActor(a, dt);
    this.updateProjectiles(dt);
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!;
      b.t += dt * 4;
      b.mesh.scale.setScalar(0.4 + b.t * 2.2);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - b.t));
      if (b.t >= 1) {
        b.mesh.removeFromParent();
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number): void {
    const kx = (this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('arrowleft') ? 1 : 0);
    const ky = (this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('arrowdown') ? 1 : 0);
    this.turnCamera(-(this.lookStick.x + kx) * 2.4 * dt, -(this.lookStick.y + ky) * 1.5 * dt);
  }

  private controlPlayer(): void {
    const a = this.me;
    if (a.state === 'ko' || this.ended) {
      a.vel.x = a.vel.z = 0;
      return;
    }
    let mx = this.moveStick.x + (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    let my = this.moveStick.y + (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    // Andar é relativo à câmera: para cima na alavanca = para onde a câmera olha.
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    a.vel.x = (fx * my - fz * mx) * PLAYER_SPEED;
    a.vel.z = (fz * my + fx * mx) * PLAYER_SPEED;
    if (this.jumpQueued && a.onGround) {
      a.vel.y = JUMP_SPEED;
      a.onGround = false;
      tone(320, 0.16, 'square', 0.04, 640);
    }
    this.jumpQueued = false;

    if (a.state !== 'fighting') return;
    const f = this.fighter(a);
    const wantsSpecial = this.specialHeld || this.keys.has('k') || this.keys.has('e');
    const wantsBasic = this.attackHeld || this.keys.has('j') || this.keys.has('f');
    if (wantsSpecial && f.special && a.specialIn <= 0) this.fire(a, f.special, true);
    else if (wantsBasic && a.basicIn <= 0) this.fire(a, f.basic, true);
    this.attackBtn.style.setProperty('--cd', String(Math.max(0, a.basicIn / f.basic.cooldown)));
    if (f.special) this.specialBtn.style.setProperty('--cd', String(Math.max(0, a.specialIn / f.special.cooldown)));
    this.specialBtn.classList.toggle('is-ready', !!f.special && a.specialIn <= 0);
  }

  private controlFoe(dt: number): void {
    const a = this.foe;
    const target = this.me;
    const rng = this.deps.rng;
    if (a.state === 'ko' || this.ended) {
      a.vel.x = a.vel.z = 0;
      return;
    }
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.8 + rng.next() * 1.6;
      this.aiStrafe = rng.next() < 0.5 ? -1 : 1;
      this.aiRange = 7 + rng.next() * 5;
    }
    const dx = target.pos.x - a.pos.x;
    const dz = target.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;
    const radial = dist > this.aiRange + 1 ? 1 : dist < this.aiRange - 1 ? -1 : 0;
    let vx = nx * radial - nz * this.aiStrafe * 0.8;
    let vz = nz * radial + nx * this.aiStrafe * 0.8;
    // Perto da mureta, volta para o meio em vez de ficar raspando nela.
    const fromCenter = Math.hypot(a.pos.x, a.pos.z);
    if (fromCenter > ARENA_RADIUS - 4) {
      vx -= (a.pos.x / fromCenter) * 1.2;
      vz -= (a.pos.z / fromCenter) * 1.2;
    }
    const len = Math.hypot(vx, vz) || 1;
    a.vel.x = (vx / len) * FOE_SPEED;
    a.vel.z = (vz / len) * FOE_SPEED;

    // Às vezes pula o golpe que vem na direção dele.
    for (const p of this.projectiles) {
      if (p.from !== 'me' || p.dodgeRolled || p.mesh.position.distanceTo(a.pos) > 7) continue;
      p.dodgeRolled = true;
      if (a.onGround && rng.next() < 0.3) {
        a.vel.y = JUMP_SPEED;
        a.onGround = false;
      }
    }

    if (a.state !== 'fighting' || target.state === 'ko') return;
    if (a.basicIn > 0) return;
    this.aiFireIn -= dt;
    if (this.aiFireIn > 0 || dist > 20) return;
    this.aiFireIn = 0.3 + rng.next() * 0.7;
    const f = this.fighter(a);
    const useSpecial = !!f.special && a.specialIn <= 0 && rng.next() < 0.4;
    // Metade dos golpes mira onde o jogador está indo; a outra metade, onde ele está.
    this.fire(a, useSpecial ? f.special! : f.basic, rng.next() < 0.5, (rng.next() - 0.5) * 0.12);
  }

  /** Os dois bonecos não atravessam um ao outro. */
  private separate(): void {
    const dx = this.foe.pos.x - this.me.pos.x;
    const dz = this.foe.pos.z - this.me.pos.z;
    const dist = Math.hypot(dx, dz);
    const min = BODY_RADIUS * 2;
    if (dist >= min || dist === 0 || Math.abs(this.foe.pos.y - this.me.pos.y) > BODY_HEIGHT) return;
    const push = (min - dist) / 2;
    this.me.pos.x -= (dx / dist) * push;
    this.me.pos.z -= (dz / dist) * push;
    this.foe.pos.x += (dx / dist) * push;
    this.foe.pos.z += (dz / dist) * push;
  }

  private updateActor(a: Actor, dt: number): void {
    a.basicIn -= dt;
    a.specialIn -= dt;
    a.swapIn -= dt;
    a.stateT += dt;
    a.punch = Math.max(0, a.punch - dt * 4);
    a.flash = Math.max(0, a.flash - dt * 5);

    // Movimento no chão, empurrão do golpe e limites da arena.
    a.pos.x += (a.vel.x + a.knock.x) * dt;
    a.pos.z += (a.vel.z + a.knock.y) * dt;
    a.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    const fromCenter = Math.hypot(a.pos.x, a.pos.z);
    const limit = ARENA_RADIUS - 1.4;
    if (fromCenter > limit) {
      a.pos.x *= limit / fromCenter;
      a.pos.z *= limit / fromCenter;
    }
    let ground = 0;
    for (const o of OBSTACLES) {
      const px = a.pos.x - o.x;
      const pz = a.pos.z - o.z;
      if (a.pos.y >= o.h - 0.25) {
        if (Math.abs(px) < o.hw + 0.3 && Math.abs(pz) < o.hd + 0.3) ground = Math.max(ground, o.h);
        continue;
      }
      const ox = o.hw + BODY_RADIUS - Math.abs(px);
      const oz = o.hd + BODY_RADIUS - Math.abs(pz);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) a.pos.x += Math.sign(px || 1) * ox;
      else a.pos.z += Math.sign(pz || 1) * oz;
    }
    a.vel.y -= GRAVITY * dt;
    a.pos.y += a.vel.y * dt;
    if (a.pos.y <= ground) {
      a.pos.y = ground;
      a.vel.y = 0;
      a.onGround = true;
    } else {
      a.onGround = false;
    }

    // Olha para onde anda; a passada acompanha a velocidade.
    const speed = Math.hypot(a.vel.x, a.vel.z);
    if (speed > 0.3 && a.punch <= 0) {
      const want = Math.atan2(a.vel.x, a.vel.z);
      const diff = Math.atan2(Math.sin(want - a.facing), Math.cos(want - a.facing));
      a.facing += diff * Math.min(1, dt * 12);
    }
    a.stride += (Math.min(1, speed / PLAYER_SPEED) - a.stride) * Math.min(1, dt * 10);
    a.phase += dt * (6 + speed);

    const g = a.model.group;
    g.position.copy(a.pos);
    g.rotation.set(0, a.facing, 0);
    g.scale.setScalar(1);
    a.model.pose(a.stride, a.phase, a.punch, !a.onGround);
    a.model.flash(a.flash);
    if (a.state === 'entering') {
      // Entra "pulando" do chão, com um leve exagero no fim.
      const t = Math.min(1, a.stateT / (ENTER_SECONDS * 0.5));
      g.scale.setScalar(t * (1 + 0.25 * Math.sin(t * Math.PI)));
      if (a.stateT >= ENTER_SECONDS) a.state = 'fighting';
    } else if (a.state === 'ko') {
      const t = Math.min(1, a.stateT / 0.5);
      g.rotation.x = (-Math.PI / 2) * t;
      g.position.y = a.pos.y + 0.1 * t;
      if (a.stateT > 0.9) g.scale.setScalar(Math.max(0.001, 1 - (a.stateT - 0.9) / 0.4));
      if (a.stateT >= KO_SECONDS) this.afterKo(a);
    }
    a.shadow.position.set(a.pos.x, ground + 0.03, a.pos.z);
    a.shadow.scale.setScalar(Math.max(0.35, 1 - (a.pos.y - ground) * 0.18) * g.scale.x);
  }

  // ── Golpes ──────────────────────────────────────────────────────────────────────

  /** Lança o golpe na direção do adversário; `lead` mira onde ele vai estar. */
  private fire(a: Actor, move: Move, lead: boolean, error = 0): void {
    const target = this.other(a);
    const speed = move.special ? 14 : 18;
    const radius = move.special ? 0.62 : 0.36;
    const from = this.tmp.set(a.pos.x, a.pos.y + CHEST, a.pos.z).clone();
    const aim = new THREE.Vector3(target.pos.x, target.pos.y + CHEST, target.pos.z);
    if (target.state === 'ko') {
      aim.set(a.pos.x + Math.sin(a.facing) * 10, a.pos.y + CHEST, a.pos.z + Math.cos(a.facing) * 10);
    } else if (lead) {
      const t = from.distanceTo(aim) / speed;
      aim.x += target.vel.x * t;
      aim.z += target.vel.z * t;
    }
    const dir = aim.sub(from).normalize();
    if (error) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), error);
    a.facing = Math.atan2(dir.x, dir.z);
    a.punch = 1;
    if (move.special) a.specialIn = move.cooldown * (a.side === 'foe' ? FOE_COOLDOWN_FACTOR : 1);
    // O especial também "gasta" o ataque comum por um instante, para não sair os dois juntos.
    a.basicIn = (move.special ? 0.6 : move.cooldown) * (a.side === 'foe' ? FOE_COOLDOWN_FACTOR : 1);

    const type = this.fighter(a).type;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshBasicMaterial({ color: typeColor(type) }),
    );
    const glow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 1.6, 1),
      new THREE.MeshBasicMaterial({ color: typeColor(type), transparent: true, opacity: 0.3, depthWrite: false }),
    );
    mesh.add(glow);
    mesh.position.copy(from).addScaledVector(dir, 0.9);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: dir.multiplyScalar(speed),
      from: a.side,
      move,
      attackerType: type,
      radius,
      life: 2.2,
      dodgeRolled: false,
    });
    if (move.special) tone(180, 0.35, 'sawtooth', 0.05, 720);
    else tone(a.side === 'me' ? 520 : 380, 0.12, 'square', 0.035, 240);
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      const pos = p.mesh.position;
      pos.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.y += dt * 7;
      p.life -= dt;
      const target = p.from === 'me' ? this.foe : this.me;
      let gone = p.life <= 0 || pos.y < 0 || Math.hypot(pos.x, pos.z) > ARENA_RADIUS;
      for (const o of OBSTACLES) {
        if (pos.y < o.h && Math.abs(pos.x - o.x) < o.hw && Math.abs(pos.z - o.z) < o.hd) gone = true;
      }
      const hit =
        !gone &&
        target.state === 'fighting' &&
        Math.hypot(pos.x - target.pos.x, pos.z - target.pos.z) < BODY_RADIUS + p.radius &&
        pos.y > target.pos.y - p.radius &&
        pos.y < target.pos.y + BODY_HEIGHT + p.radius;
      if (hit) this.land(p, target);
      if (hit || gone) {
        if (gone) this.burst(pos, p.attackerType, 0.5);
        p.mesh.removeFromParent();
        p.mesh.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        });
        this.projectiles.splice(i, 1);
      }
    }
  }

  private land(p: Projectile, target: Actor): void {
    const defender = this.fighter(target);
    const { amount, superEffective } = hitFor(p.move, p.attackerType, defender);
    target.hp[target.active] = Math.max(0, target.hp[target.active]! - amount);
    target.flash = 1;
    const push = p.move.special ? 9 : 5;
    const flat = Math.hypot(p.vel.x, p.vel.z) || 1;
    target.knock.set((p.vel.x / flat) * push, (p.vel.z / flat) * push);
    this.burst(p.mesh.position, p.attackerType, p.move.special ? 1.5 : 1);
    this.float(p.mesh.position, superEffective ? `${amount}!` : String(amount), target.side, superEffective);
    tone(superEffective ? 140 : 200, 0.18, 'triangle', 0.09, 70);
    if (target === this.me) navigator.vibrate?.(superEffective ? [30, 40, 30] : 25);
    if (superEffective) this.say('Super efetivo!', 900);
    if (target.hp[target.active]! > 0) return;
    target.state = 'ko';
    target.stateT = 0;
    tone(300, 0.5, 'sawtooth', 0.06, 60);
    this.say(`${defender.card.name} desmaiou!`);
  }

  private burst(at: THREE.Vector3, type: string, size: number): void {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * 0.6, 1),
      new THREE.MeshBasicMaterial({ color: typeColor(type), transparent: true, opacity: 0.85, depthWrite: false }),
    );
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.bursts.push({ mesh, t: 0 });
  }

  /** Número de dano que sobe e some por cima da arena. */
  private float(at: THREE.Vector3, text: string, side: Side, strong: boolean): void {
    const p = this.toScreen(this.tmp.copy(at).setY(at.y + 1));
    if (!p) return;
    const node = el('span', { className: `arena__float arena__float--${side}${strong ? ' is-strong' : ''}`, text });
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    this.floats.append(node);
    window.setTimeout(() => node.remove(), 900);
  }

  private toScreen(world: THREE.Vector3): { x: number; y: number } | null {
    const v = world.project(this.camera);
    if (v.z > 1) return null;
    const { clientWidth: w, clientHeight: h } = this.deps.root;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  // ── Trocas e fim de luta ────────────────────────────────────────────────────────

  private afterKo(a: Actor): void {
    const next = a.hp.findIndex((hp) => hp > 0);
    if (next < 0) {
      this.finish(a === this.foe);
      return;
    }
    this.enter(a, next);
    this.say(a === this.me ? `Vai, ${this.fighter(a).card.name}!` : `O adversário mandou ${this.fighter(a).card.name}!`);
  }

  private swapTo(index: number): void {
    const a = this.me;
    if (this.ended || a.state !== 'fighting' || a.swapIn > 0) return;
    if (index === a.active || !(a.hp[index]! > 0)) return;
    a.swapIn = SWAP_COOLDOWN;
    this.enter(a, index);
    this.say(`Vai, ${this.fighter(a).card.name}!`, 1000);
    tone(440, 0.2, 'sine', 0.06, 880);
  }

  private enter(a: Actor, index: number): void {
    a.active = index;
    a.model.dispose();
    a.model = new FighterModel(this.fighter(a), this.texture(this.fighter(a)));
    this.scene.add(a.model.group);
    a.state = 'entering';
    a.stateT = 0;
    a.basicIn = a.specialIn = 0;
    a.knock.set(0, 0);
    this.refreshActive(a);
  }

  private finish(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.attackHeld = this.specialHeld = false;
    this.moveStick.reset();
    this.lookStick.reset();
    if (won) [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.28, 'square', 0.05), i * 130));
    else tone(260, 0.8, 'sawtooth', 0.05, 90);
    const again = el('button', { className: 'arena__cta', attrs: { type: 'button' }, text: 'Lutar de novo' });
    again.addEventListener('click', () => this.deps.onRematch());
    const leave = el('button', { className: 'arena__cta arena__cta--quiet', attrs: { type: 'button' }, text: 'Trocar o time' });
    leave.addEventListener('click', () => this.deps.onExit());
    const left = this.me.hp.filter((hp) => hp > 0).length;
    this.deps.root.append(
      el('div', {
        className: `arena__end ${won ? 'is-win' : 'is-loss'}`,
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': won ? 'Você venceu' : 'Você perdeu' },
        children: [
          el('h2', { text: won ? 'Você venceu!' : 'Não foi dessa vez' }),
          el('p', {
            text: won
              ? `Sobrou ${left} Pokémon de pé no seu time.`
              : 'O adversário derrubou os seus três Pokémon.',
          }),
          el('div', { className: 'arena__end-actions', children: [again, leave] }),
          el('small', { text: `seed 0x${this.deps.seed.toString(16)}` }),
        ],
      }),
    );
    again.focus();
  }

  // ── Desenho ─────────────────────────────────────────────────────────────────────

  private render(): void {
    const a = this.me;
    const cos = Math.cos(this.camPitch);
    const tx = a.pos.x;
    const ty = a.pos.y + 2;
    const tz = a.pos.z;
    this.camera.position.set(
      tx - Math.sin(this.camYaw) * cos * CAMERA_DISTANCE,
      ty + Math.sin(this.camPitch) * CAMERA_DISTANCE,
      tz - Math.cos(this.camYaw) * cos * CAMERA_DISTANCE,
    );
    this.camera.lookAt(tx, ty, tz);
    this.renderer.render(this.scene, this.camera);

    for (const [actor, hud] of [[this.me, this.hudMe], [this.foe, this.hudFoe]] as const) {
      const f = this.fighter(actor);
      const hp = actor.hp[actor.active]!;
      hud.bar.style.width = `${(hp / f.hp) * 100}%`;
      hud.bar.classList.toggle('is-low', hp / f.hp <= 0.3);
      hud.num.textContent = `${hp} / ${f.hp}`;
      hud.slots.forEach((slot, i) => {
        slot.classList.toggle('is-out', actor.hp[i]! <= 0);
        (slot.lastElementChild as HTMLElement).style.width = `${(actor.hp[i]! / actor.team[i]!.hp) * 100}%`;
      });
    }
    this.hudMe.slots.forEach((slot) => slot.classList.toggle('is-waiting', this.me.swapIn > 0));

    // Barrinha de vida flutuando sobre o adversário.
    const foe = this.foe;
    const p = foe.state === 'ko' ? null : this.toScreen(this.tmp.set(foe.pos.x, foe.pos.y + 3.1, foe.pos.z));
    this.foeTag.hidden = !p;
    if (p) {
      this.foeTag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      (this.foeTag.firstElementChild as HTMLElement).style.width = `${(foe.hp[foe.active]! / this.fighter(foe).hp) * 100}%`;
    }
  }
}
