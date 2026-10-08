import { el } from '../../lib/dom.js';
import { logout as apiLogout } from '../../api/auth.js';
import { config } from '../../config.js';
import { NAV, isActive, groupIsActive, loadOpenGroups, saveOpenGroups } from '../../lib/nav.js';

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
  // Группы сворачиваются; раскрытые вручную запоминаются, группа с текущей страницей раскрыта всегда.
  const openGroups = loadOpenGroups();
  const groups = [];
  const nav = el(
    'nav',
    { class: 'shell-nav', id: navId, 'aria-label': 'Основная навигация' },
    NAV.map((entry) => (entry.group ? navGroup(entry) : el('a', { href: entry.href, class: 'shell-nav-link' }, [navIcon(entry), entry.label]))),
  );

  function navGroup(entry) {
    const panelId = `${navId}-${groups.length}`;
    const chevron = el('span', { class: 'shell-nav-chevron', 'aria-hidden': 'true' }, '›');
    const toggle = el('button', {
      type: 'button', class: 'shell-nav-link shell-nav-group', 'aria-controls': panelId, 'aria-expanded': 'false',
      onclick: () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        setGroupOpen(group, open);
        if (open) openGroups.add(entry.group); else openGroups.delete(entry.group);
        saveOpenGroups(openGroups);
      },
    }, [navIcon(entry), entry.group, chevron]);
    const panel = el('div', { class: 'shell-nav-sub', id: panelId },
      entry.items.map((item) => el('a', { href: item.href, class: 'shell-nav-link' }, [navIcon(item), item.label])));
    const group = { entry, toggle, panel };
    setGroupOpen(group, openGroups.has(entry.group));
    groups.push(group);
    return el('div', { class: 'shell-nav-section' }, [toggle, panel]);
  }

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
  updateActiveNav(nav, groups);

  // Роутер вызывает refreshNav() после каждого перехода (см. app.js), т.к.
  // навигация внутри приложения идёт через pushState, а не popstate.
  return {
    outlet: main,
    refreshNav: () => {
      setNavOpen(false);
      updateActiveNav(nav, groups);
    },
    cleanup: () => {},
  };
}

function setGroupOpen(group, open) {
  group.toggle.setAttribute('aria-expanded', String(open));
  group.panel.hidden = !open;
}

function updateActiveNav(nav, groups) {
  const path = window.location.pathname;
  for (const link of nav.querySelectorAll('a')) {
    link.classList.toggle('active', isActive(link.getAttribute('href'), path));
  }
  // Группа с текущей страницей раскрывается и подсвечивается; ручное состояние остальных не трогаем.
  for (const group of groups) {
    const active = groupIsActive(group.entry, path);
    group.toggle.classList.toggle('has-active', active);
    if (active) setGroupOpen(group, true);
  }
}
