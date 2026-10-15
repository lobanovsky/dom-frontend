import { createRouter } from './router.js';
import { onUnauthenticated, onGlobalError, ApiError } from './api/client.js';
import { me } from './api/auth.js';
import { isAuthenticated, setAuthenticated, setUser } from './state/session.js';
import { isAdmin } from './lib/permissions.js';
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
import { paymentExportsPage } from './pages/payments/paymentExportsPage.js';
import { paymentRegistryPage } from './pages/payments/paymentRegistryPage.js';
import { bankStatementsPage } from './pages/payments/bankStatementsPage.js';
import { sberApiPage } from './pages/payments/sberApiPage.js';
import { mailSyncPage } from './pages/payments/mailSyncPage.js';
import { bankStatementPage } from './pages/payments/bankStatementPage.js';
import { paymentRulesPage } from './pages/payments/paymentRulesPage.js';
import { counterpartiesPage } from './pages/payments/counterpartiesPage.js';
import { metersPage } from './pages/meters/metersPage.js';
import { meterPage } from './pages/meters/meterPage.js';
import { usersPage } from './pages/users/usersPage.js';

const appRoot = document.getElementById('app');

// Страницы только для администратора: сервер всё равно не отдаст данные, но и пустую страницу с ошибками показывать незачем.
function adminOnly(mount) {
  return (container, ...args) => {
    if (isAdmin()) return mount(container, ...args);
    container.replaceChildren(el('div', { class: 'card empty-state' }, [el('p', {}, 'Недостаточно прав для этой страницы'), el('a', { href: '/' }, 'На главную')]));
    return undefined;
  };
}

const routes = [
  { pattern: '/', mount: dashboardPage },
  { pattern: '/organizations', mount: organizationsPage },
  { pattern: '/legal-entities', mount: legalEntitiesPage },
  { pattern: '/persons', mount: personsPage },
  { pattern: '/buildings', mount: buildingsPage },
  { pattern: '/buildings/:id', mount: buildingPage },
  { pattern: '/premises/:id', mount: premisesPage },
  { pattern: '/meters', mount: metersPage },
  { pattern: '/meters/:id', mount: meterPage },
  { pattern: '/bank-accounts', mount: bankAccountsPage },
  { pattern: '/payments/incoming', mount: incomingPaymentsPage },
  { pattern: '/payment-registries', mount: paymentRegistriesPage },
  { pattern: '/payment-exports', mount: paymentExportsPage },
  { pattern: '/payment-registries/:id', mount: paymentRegistryPage },
  { pattern: '/bank-statements', mount: bankStatementsPage },
  { pattern: '/bank-statements/:id', mount: bankStatementPage },
  { pattern: '/sber-api', mount: sberApiPage },
  { pattern: '/mail', mount: mailSyncPage },
  { pattern: '/payments/outgoing', mount: outgoingPaymentsPage },
  { pattern: '/payment-categories', mount: paymentCategoriesPage },
  { pattern: '/payment-rules', mount: adminOnly(paymentRulesPage) },
  { pattern: '/users', mount: adminOnly(usersPage) },
  { pattern: '/counterparties', mount: counterpartiesPage },
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
  const onSuccess = async () => {
    try {
      setUser(await me());
    } catch (err) {
      notifyGlobalError(err);
      return;
    }
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
    setUser(await me());
    showShell();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) notifyGlobalError(err);
    showAuth();
  }
}

bootstrap();
