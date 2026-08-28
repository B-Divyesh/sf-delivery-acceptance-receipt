export interface LicenseState {
  token: string;
  valid: boolean;
  checkedAt: number;
  reason?: string;
}

const SLUG = 'delivery-acceptance-receipt';
const KEY = `sb_license:${SLUG}`;
const STATE_KEY = `${KEY}:verdict`;
const API = `https://api.sociobot.in/api/v1/products/${SLUG}`;
export const buyUrl = `${API}/checkout`;

export function captureReturnedLicense(): string | null {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return null;
  localStorage.setItem(KEY, token);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export function restoreLicense(token: string): void {
  localStorage.setItem(KEY, token.trim());
  localStorage.removeItem(STATE_KEY);
}

export function cachedLicense(): LicenseState | null {
  const token = localStorage.getItem(KEY);
  if (!token) return null;
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) ?? '') as LicenseState;
    return state.token === token ? state : { token, valid: false, checkedAt: 0 };
  } catch {
    return { token, valid: false, checkedAt: 0 };
  }
}

export function isPremium(): boolean {
  return cachedLicense()?.valid === true;
}

export async function verifyLicense(force = false): Promise<LicenseState | null> {
  const token = localStorage.getItem(KEY);
  if (!token) return null;
  const cached = cachedLicense();
  if (!force && cached && Date.now() - cached.checkedAt < 86_400_000) return cached;
  try {
    const response = await fetch(`${API}/verify?license=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Verification unavailable');
    const verdict = await response.json() as { valid: boolean; reason?: string };
    const state = { token, valid: verdict.valid, checkedAt: Date.now(), reason: verdict.reason };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return cached;
  }
}
