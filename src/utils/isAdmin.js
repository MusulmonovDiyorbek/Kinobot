import { config } from '../config/index.js';
export const isAdmin = id => config.adminIds.includes(Number(id));
