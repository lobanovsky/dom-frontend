import { createRouter } from './router.js';
import { onUnauthenticated, onGlobalError, ApiError } from './api/client.js';
import { me } from './api/auth.js';
import { isAuthenticated, setAuthenticated } from './state/session.js';
import { setNavigate } from './state/nav.js';
import { renderLoginPage } from './pages/login/loginPage.js';
import { renderShell } from './pages/shell/shellLayout.js';
import { toast } from './ui/toast.js';
import { el } from './lib/dom.js';
import { dashboardPage } from './pages/dashboard/dashboardPage.js';
import { organizationsPage } from './pages/organizations/organizationsPage.js';
import { legalEntitiesPage } from './pages/legalEntities/legalEntitiesPage.js';
import { personsPage } from './pages/persons/personsPage.js';
import { buildingsPage } from './pages/buildings/buildingsPage.js';
import { buildingPage } from './pages/buildings/buildingPage.js';
import { premisesPage } from './pages/premises/premisesPage.js';
import { bankAccountsPage } from './pages/payments/bankAccountsPage.js';
import { paymentCategoriesPage } from './pages/payments/paymentCategoriesPage.js';
import { incomingPaymentsPage } from './pages/payments/incomingPaymentsPage.js';
import { outgoingPaymentsPage } from './pages/payments/outgoingPaymentsPage.js';
import { paymentRegistriesPage } from './pages/payments/paymentRegistriesPage.js';
import { paymentRegistryPage } from './pages/payments/paymentRegistryPage.js';

const appRoot = document.getElementById('app');

const routes = [
  { pattern: '/', mount: dashboardPage },
  { pattern: '/organizations', mount: organizationsPage },
  { pattern: '/legal-entities', mount: legalEntitiesPage },
  { pattern: '/persons', mount: personsPage },
  { pattern: '/buildings', mount: buildingsPage },
  { pattern: '/buildings/:id', mount: buildingPage },
  { pattern: '/premises/:id', mount: premisesPage },
  { pattern: '/bank-accounts', mount: bankAccountsPage },
  { pattern: '/payments/incoming', mount: incomingPaymentsPage },
  { pattern: '/payment-registries', mount: paymentRegistriesPage },
  { pattern: '/payment-registries/:id', mount: paymentRegistryPage },
  { pattern: '/payments/outgoing', mount: outgoingPaymentsPage },
  { pattern: '/payment-categories', mount: paymentCategoriesPage },
];

let router = null;
let shellCleanup = null;

function notifyGlobalError(error) {
  console.error('[dom]', error);
  toast.error(error.message || 'Произошла ошибка. Повторите попытку позже.');
}
onGlobalError(notifyGlobalError);

function stopRouter() {
  if (router) {
    router.stop();
    router = null;
  }
}

function stopShell() {
  if (shellCleanup) {
    shellCleanup();
    shellCleanup = null;
  }
}

function showAuth() {
  stopRouter();
  stopShell();
  // После входа возвращаемся туда, куда шли (кроме самой /login).
  const returnTo = window.location.pathname === '/login' ? '/' : window.location.pathname + window.location.search;
  const onSuccess = () => {
    window.history.replaceState(null, '', returnTo);
    showShell();
  };
  const authRoutes = [{ pattern: '/login', mount: (c) => renderLoginPage(c, { onSuccess }) }];
  router = createRouter(authRoutes, appRoot);
  router.notFound((c) => renderLoginPage(c, { onSuccess }));
  setNavigate(router.navigate);
  router.start();
}

function showShell() {
  stopRouter();
  stopShell();
  setAuthenticated(true);
  const { outlet, refreshNav, cleanup } = renderShell(appRoot, { onLogout: handleLoggedOut });
  shellCleanup = cleanup;
  router = createRouter(routes, outlet, { afterRender: refreshNav });
  router.notFound((c) => {
    c.replaceChildren(el('div', { class: 'card empty-state' }, [el('p', {}, 'Страница не найдена'), el('a', { href: '/' }, 'На главную')]));
  });
  setNavigate(router.navigate);
  router.start();
}

function handleLoggedOut() {
  setAuthenticated(false);
  window.history.replaceState(null, '', '/login');
  showAuth();
}

// Любой 401 посреди работы (истекла сессия) возвращает на вход. Во время
// самой формы входа isAuthenticated() ещё false — неверный пароль
// обрабатывает loginPage.js.
onUnauthenticated(() => {
  if (isAuthenticated()) handleLoggedOut();
});

async function bootstrap() {
  try {
    await me();
    showShell();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) notifyGlobalError(err);
    showAuth();
  }
}

bootstrap();
