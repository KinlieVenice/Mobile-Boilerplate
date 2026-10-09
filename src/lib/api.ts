import { Platform } from 'react-native';

// Set SERVER_API_HOST in .env (use your PC's LAN IP for a physical phone).
// Fallback covers simulators: Android emulator reaches the host via 10.0.2.2.
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_URL = process.env.SERVER_API_HOST ?? `http://${DEFAULT_HOST}:5050`;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
