import { FamilyError, type FamilyApi, type FamilyStatus, type Player } from '../persistence/family-api.js';
import type { PlayerSession } from '../persistence/family-store.js';
import { el } from '../utils/dom.js';

/**
 * Entrada: na primeira vez, cria a família (dois nomes e um PIN); depois, "Quem está
 * jogando?" e o PIN uma vez por aparelho. Resolve com a sessão escolhida.
 */
export function renderLogin(root: HTMLElement, api: FamilyApi, status: FamilyStatus): Promise<PlayerSession> {
  return new Promise((resolve) => {
    if (status.configured) renderChoose(root, api, status.players, resolve);
    else renderSetup(root, api, resolve);
  });
}

function pinInput(label: string): HTMLInputElement {
  return el('input', {
    className: 'login__input login__pin',
    attrs: {
      type: 'password',
      inputmode: 'numeric',
      autocomplete: 'off',
      pattern: '[0-9]*',
      maxlength: '8',
      'aria-label': label,
      placeholder: '••••',
    },
  });
}

function errorLine(): HTMLElement {
  return el('p', { className: 'login__error', attrs: { role: 'alert' } });
}

function shell(root: HTMLElement, title: string, lead: string, form: HTMLElement): void {
  root.replaceChildren(
    el('div', {
      className: 'login',
      children: [
        el('h1', { className: 'login__title', text: title }),
        el('p', { className: 'login__lead', text: lead }),
        form,
      ],
    }),
  );
}

function renderSetup(root: HTMLElement, api: FamilyApi, done: (s: PlayerSession) => void): void {
  const name1 = el('input', { className: 'login__input', attrs: { value: 'Papai', maxlength: '24', 'aria-label': 'Jogador 1' } });
  const name2 = el('input', { className: 'login__input', attrs: { placeholder: 'Nome do filho', maxlength: '24', 'aria-label': 'Jogador 2' } });
  const pin = pinInput('PIN da família');
  const err = errorLine();
  const submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' }, text: 'Começar' });
  const form = el('form', {
    className: 'login__form',
    children: [
      el('label', { className: 'login__label', children: ['Jogador 1', name1] }),
      el('label', { className: 'login__label', children: ['Jogador 2', name2] }),
      el('label', { className: 'login__label', children: ['PIN da família (4 a 8 números)', pin] }),
      err,
      submit,
    ],
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const a = name1.value.trim();
    const b = name2.value.trim();
    if (!a || !b) return void (err.textContent = 'Escreva o nome dos dois jogadores.');
    if (!/^[0-9]{4,8}$/.test(pin.value)) return void (err.textContent = 'O PIN precisa ter de 4 a 8 números.');
    submit.disabled = true;
    api
      .setup(pin.value, a, b)
      .then(() => api.status())
      .then((st) => renderChoose(root, api, st.players, done, pin.value))
      .catch((e: unknown) => {
        err.textContent = e instanceof FamilyError ? e.message : 'Não deu para falar com o servidor.';
        submit.disabled = false;
      });
  });
  shell(root, 'Fichário da família', 'Dois jogadores, cada um com o seu fichário, e trocas entre vocês.', form);
  name2.focus();
}

function renderChoose(
  root: HTMLElement,
  api: FamilyApi,
  players: readonly Player[],
  done: (s: PlayerSession) => void,
  knownPin?: string,
): void {
  const list = el('div', { className: 'login__players' });
  for (const p of players) {
    const btn = el('button', { className: 'login__player', attrs: { type: 'button' }, text: p.name });
    btn.addEventListener('click', () => {
      if (knownPin) done({ player: p.id, pin: knownPin });
      else renderPin(root, api, p, players, done);
    });
    list.append(btn);
  }
  shell(root, 'Quem está jogando?', 'Neste aparelho, você só escolhe uma vez.', list);
}

function renderPin(
  root: HTMLElement,
  api: FamilyApi,
  player: Player,
  players: readonly Player[],
  done: (s: PlayerSession) => void,
): void {
  const pin = pinInput('PIN da família');
  const err = errorLine();
  const submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' }, text: 'Entrar' });
  const back = el('button', { className: 'btn btn--link', attrs: { type: 'button' }, text: 'Não sou eu' });
  back.addEventListener('click', () => renderChoose(root, api, players, done));
  const form = el('form', {
    className: 'login__form',
    children: [el('label', { className: 'login__label', children: ['PIN da família', pin] }), err, submit, back],
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    submit.disabled = true;
    api
      .checkPin(pin.value)
      .then(() => done({ player: player.id, pin: pin.value }))
      .catch((e: unknown) => {
        err.textContent = e instanceof FamilyError ? e.message : 'Não deu para falar com o servidor.';
        submit.disabled = false;
        pin.select();
      });
  });
  shell(root, `Oi, ${player.name}!`, 'Digite o PIN da família.', form);
  pin.focus();
}
