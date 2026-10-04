import { client } from './client.js';

export const login = (username, password) => client.post('/api/v1/auth/login', { username, password });
export const logout = () => client.post('/api/v1/auth/logout');
export const me = () => client.get('/api/v1/auth/me');
