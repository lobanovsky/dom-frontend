import { el } from '../../lib/dom.js';
import { logout as apiLogout } from '../../api/auth.js';
import { config } from '../../config.js';

const NAV_ITEMS = [
  { href: '/', label: 'Обзор', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { href: '/buildings', label: 'Дома', icon: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>' },
  { href: '/persons', label: 'Физлица', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href: '/legal-entities', label: 'Юрлица', icon: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' },
  { href: '/payments/incoming', label: 'Входящие платежи', icon: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>' },
  { href: '/payment-registries', label: 'Реестры', icon: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/>' },
  { href: '/payments/outgoing', label: 'Исходящие платежи', icon: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>' },
  { href: '/bank-accounts', label: 'Банковские счета', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>' },
  { href: '/payment-categories', label: 'Категории платежей', icon: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01"/>' },
  { href: '/organizations', label: 'Организации', icon: '<path d="M3 21h18M6 21V10M10 21V10M14 21V10M18 21V10M12 3l9 5H3z"/>' },
];

// SVG собираем через разметку: document.createElement('svg') создаёт элемент
// в HTML-пространстве имён, и браузер его не рисует.
function navIcon(item) {
  return el('span', {
    class: 'shell-nav-icon',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>`,
  });
}

// Рендерит постоянный каркас (шапка + нав) и возвращает <main>, в который
// роутер монтирует текущую страницу.
export function renderShell(container, { onLogout } = {}) {
  const navId = 'main-navigation';
  const nav = el(
    'nav',
    { class: 'shell-nav', id: navId, 'aria-label': 'Основная навигация' },
    NAV_ITEMS.map((item) => el('a', { href: item.href, class: 'shell-nav-link' }, [navIcon(item), item.label])),
  );

  const navBackdrop = el('div', {
    class: 'shell-nav-backdrop',
    'aria-hidden': 'true',
    onclick: () => setNavOpen(false),
  });

  const menuButton = el(
    'button',
    {
      type: 'button',
      class: 'shell-menu-button',
      'aria-label': 'Открыть меню',
      'aria-controls': navId,
      'aria-expanded': 'false',
      onclick: () => setNavOpen(!shell.classList.contains('shell--nav-open')),
    },
    [el('span', { 'aria-hidden': 'true' }, '☰')],
  );

  const logoutButton = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost',
      onclick: async () => {
        logoutButton.disabled = true;
        try {
          await apiLogout();
        } catch {
          // даже если запрос разлогинивания не удался, выходим локально —
          // cookie всё равно HttpOnly и клиент не может её перепроверить.
        } finally {
          onLogout?.();
        }
      },
    },
    'Выйти',
  );

  const header = el('header', { class: 'shell-header' }, [
    menuButton,
    el('a', { class: 'shell-brand', href: '/' }, el('div', { class: 'shell-brand-name' }, config.appName)),
    el('div', { class: 'shell-header-spacer' }),
    logoutButton,
  ]);

  const main = el('main', { class: 'shell-main' });
  const shell = el('div', { class: 'shell' }, [header, nav, navBackdrop, main]);

  function setNavOpen(open) {
    shell.classList.toggle('shell--nav-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (open) nav.querySelector('a')?.focus();
  }

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setNavOpen(false);
  });
  shell.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNavOpen(false);
  });

  container.replaceChildren(shell);
  updateActiveNav(nav);

  // Роутер вызывает refreshNav() после каждого перехода (см. app.js), т.к.
  // навигация внутри приложения идёт через pushState, а не popstate.
  return {
    outlet: main,
    refreshNav: () => {
      setNavOpen(false);
      updateActiveNav(nav);
    },
    cleanup: () => {},
  };
}

function updateActiveNav(nav) {
  const path = window.location.pathname;
  for (const link of nav.querySelectorAll('a')) {
    const href = link.getAttribute('href');
    // Карточка помещения — часть раздела «Дома».
    const section = path.startsWith('/premises/') ? '/buildings' : path;
    const isActive = href === '/' ? section === '/' : section === href || section.startsWith(`${href}/`);
    link.classList.toggle('active', isActive);
  }
}
