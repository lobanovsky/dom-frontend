// Небольшой хелпер для построения DOM без JSX/шаблонов. attrs поддерживает
// class, on<Event> (обработчик), html (innerHTML) и обычные атрибуты;
// boolean true ставит атрибут без значения, false/null/undefined — пропускает.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'class') {
      node.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }

  appendChildren(node, children);

  return node;
}

function appendChildren(node, children) {
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
      continue;
    }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(container) {
  container.replaceChildren();
}

export function mount(container, node) {
  container.replaceChildren(node);
}

// Слушает делегированные события на container для элементов, подходящих
// под selector — удобно для таблиц/списков с кнопками в строках.
export function delegate(container, eventName, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && container.contains(target)) handler(event, target);
  };
  container.addEventListener(eventName, listener);
  return () => container.removeEventListener(eventName, listener);
}
