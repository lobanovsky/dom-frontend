// Статус описывает разрешение, регистрацию и факт входа; наличие сессии не означает «онлайн».
export function residentAccessStatus(state) {
  if (!state) return { title: 'Не загружен', tone: 'muted', detail: 'Откройте настройки кабинета для проверки.' };
  if (!state.configured) return { title: 'Не выдан', tone: 'muted', detail: '' };
  const registration = state.registered ? 'Аккаунт зарегистрирован.' : 'Аккаунт ещё не зарегистрирован.';
  if (!state.enabled || (state.registered && !state.account_active)) return { title: 'Отключён', tone: 'danger', detail: registration };
  if (!state.eligible) return { title: 'Вход недоступен', tone: 'warning', detail: `Доступ разрешён, но нет действующей собственности. ${registration}` };
  if (!state.registered) return { title: 'Разрешён', tone: 'info', detail: 'Ожидает регистрации.' };
  if (!state.last_login_at) return { title: 'Зарегистрирован', tone: 'info', detail: 'Вход пока не зафиксирован.' };
  return { title: 'Входил', tone: 'success', detail: '' };
}

// Один дополнительный запрос на страницу списка, а не отдельный запрос для каждого физлица.
export async function attachResidentAccess(items, load) {
  if (!items.length) return items;
  try {
    const states = await load(items.map((p) => p.id));
    const byId = new Map(states.map((state) => [state.person_id, state]));
    return items.map((p) => ({ ...p, resident_access: byId.get(p.id) || null }));
  } catch {
    return items.map((p) => ({ ...p, resident_access: null }));
  }
}
