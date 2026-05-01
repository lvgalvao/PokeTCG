export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

export function $$(selector: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

export interface ElOptions {
  className?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string>;
  dataset?: Record<string, string>;
  children?: (Node | string)[];
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) node.dataset[k] = v;
  }
  if (opts.children) {
    for (const child of opts.children) {
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

export function on<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | Document | Window,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(event as string, handler as EventListener, options);
  return () => target.removeEventListener(event as string, handler as EventListener, options);
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setText(node: HTMLElement, text: string): void {
  node.textContent = text;
}

export function toggle(node: HTMLElement, className: string, force?: boolean): void {
  node.classList.toggle(className, force);
}
