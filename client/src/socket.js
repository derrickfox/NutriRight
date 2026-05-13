import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io → localhost:3001
// In prod, connect to the same origin
const URL = import.meta.env.DEV ? '/' : '/';

export const socket = io(URL, { autoConnect: false });
