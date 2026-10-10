// Пункты бокового меню и разбор активного пункта/группы. Без DOM, покрыто тестами.

// Пункт: {href, label, icon}; группа: {group, icon, items: [пункт]}. Группы сворачиваются.
export const NAV = [
  { href: '/', label: 'Обзор', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { href: '/buildings', label: 'Дома', icon: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>' },
  { href: '/persons', label: 'Физлица', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href: '/legal-entities', label: 'Юрлица', icon: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>' },
  {
    group: 'Финансы',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.4-.8-1.300-1.200-2.500-1.200-1.500 0-2.500.8-2.500 1.900 0 2.600 5.200 1.300 5.200 4 0 1.100-1.100 1.900-2.700 1.900-1.300 0-2.300-.5-2.700-1.400M12 6v1.500M12 16.500V18"/>',
    items: [
      { href: '/payments/incoming', label: 'Входящие', icon: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>' },
      { href: '/payments/outgoing', label: 'Исходящие', icon: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>' },
      { href: '/payment-registries', label: 'Реестры', icon: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/>' },
      { href: '/bank-statements', label: 'Выписки', icon: '<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8M9 9h3"/>' },
      { href: '/sber-api', label: 'Банк (Сбер)', icon: '<path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 21h18"/>' },
      { href: '/payment-rules', label: 'Правила', icon: '<path d="M4 6h16M7 12h10M10 18h4"/>' },
    ],
  },
  {
    group: 'Справочники',
    icon: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13M9 7h6"/>',
    items: [
      { href: '/organizations', label: 'Организации', icon: '<path d="M3 21h18M6 21V10M10 21V10M14 21V10M18 21V10M12 3l9 5H3z"/>' },
      { href: '/bank-accounts', label: 'Банковские счета', icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>' },
      { href: '/payment-categories', label: 'Категории платежей', icon: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01"/>' },
    ],
  },
];

// Пункт активен для адреса path. Карточка помещения — часть раздела «Дома».
export function isActive(href, path) {
  const section = path.startsWith('/premises/') ? '/buildings' : path;
  return href === '/' ? section === '/' : section === href || section.startsWith(`${href}/`);
}

export const groupIsActive = (group, path) => group.items.some((item) => isActive(item.href, path));

const STORAGE_KEY = 'dom.nav.open-groups';

// Раскрытые пользователем группы запоминаются; хранилище может быть недоступно (приватный режим) — тогда всё сворачивается.
export function loadOpenGroups(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveOpenGroups(open, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...open]));
  } catch {
    // не страшно: состояние просто не запомнится
  }
}
