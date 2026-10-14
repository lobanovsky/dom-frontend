import { getUser } from '../state/session.js';

// Роли совпадают с бэкендом: admin — всё, viewer — только просмотр (и скачивание Excel/файлов).
export const ROLES = { admin: 'Администратор', viewer: 'Просмотр' };

export const roleLabel = (role) => ROLES[role] ?? role;

export const roleCanWrite = (role) => role === 'admin';

// Может ли текущий пользователь что-либо менять. Нет сведений о пользователе — считаем, что не может.
export const canWrite = () => roleCanWrite(getUser()?.role);

export const isAdmin = () => getUser()?.role === 'admin';
