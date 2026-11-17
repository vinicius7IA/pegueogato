import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenId } from './game/types';

/**
 * Roteador leve baseado na History API (sem dependências).
 * - Cada tela tem uma URL (compartilhável / recarregável).
 * - O botão "voltar" do celular/navegador navega entre telas.
 * - Telas que dependem de estado de partida (luta/resultado) nunca abrem por URL direta.
 */
export const ROUTES: Record<ScreenId, string> = {
  splash: '/',
  login: '/entrar',
  menu: '/menu',
  select: '/lutadores',
  stage_select: '/arenas',
  arena: '/luta',
  shop: '/loja',
  inventory: '/inventario',
  profile: '/perfil',
  multiplayer: '/online',
  result: '/resultado',
  settings: '/ajustes',
  bracket: '/torneio',
  credits: '/creditos',
};

export const SCREEN_TITLES: Record<ScreenId, string> = {
  splash: 'BAHIA STRETAT — Luta 3D Arcade',
  login: 'Entrar',
  menu: 'Menu',
  select: 'Lutadores',
  stage_select: 'Arenas',
  arena: 'Luta',
  shop: 'Loja',
  inventory: 'Inventário',
  profile: 'Perfil',
  multiplayer: 'Online',
  result: 'Resultado',
  settings: 'Ajustes',
  bracket: 'Torneio',
  credits: 'Créditos',
};

/** Telas que exigem uma partida em andamento: nunca restauradas por URL/voltar. */
const MATCH_ONLY: ScreenId[] = ['arena', 'result', 'bracket'];
/** Telas livres para quem ainda não fez o cadastro. */
const PUBLIC: ScreenId[] = ['splash', 'login'];

const BY_PATH = Object.fromEntries(
  (Object.entries(ROUTES) as [ScreenId, string][]).map(([id, path]) => [path, id]),
) as Record<string, ScreenId>;

function normalize(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function screenFromPath(pathname: string): ScreenId | null {
  return BY_PATH[normalize(pathname)] ?? null;
}

function resolveGuarded(target: ScreenId | null, onboarded: boolean): ScreenId {
  if (!target) return onboarded ? 'menu' : 'splash'; // rota desconhecida (404)
  if (MATCH_ONLY.includes(target)) return onboarded ? 'menu' : 'login';
  if (!onboarded && !PUBLIC.includes(target)) return 'login';
  return target;
}

export function useScreenRouter(onboarded: boolean) {
  const onboardedRef = useRef(onboarded);
  onboardedRef.current = onboarded;

  const [screen, setScreenState] = useState<ScreenId>(() =>
    resolveGuarded(screenFromPath(window.location.pathname), onboarded),
  );
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // Normaliza a URL inicial (ex.: /luta recarregada -> /menu)
  useEffect(() => {
    const path = ROUTES[screenRef.current];
    if (normalize(window.location.pathname) !== path) {
      window.history.replaceState({}, '', path);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const next = resolveGuarded(screenFromPath(window.location.pathname), onboardedRef.current);
      if (ROUTES[next] !== normalize(window.location.pathname)) {
        window.history.replaceState({}, '', ROUTES[next]);
      }
      setScreenState(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title =
      screen === 'splash'
        ? SCREEN_TITLES.splash
        : `${SCREEN_TITLES[screen]} · BAHIA STRETAT`;
  }, [screen]);

  const setScreen = useCallback((next: ScreenId) => {
    const current = screenRef.current;
    if (next === current) return;
    // splash e luta->resultado substituem a entrada: "voltar" não reabre splash nem luta encerrada
    const replace = current === 'splash' || (current === 'arena' && next === 'result');
    window.history[replace ? 'replaceState' : 'pushState']({}, '', ROUTES[next]);
    screenRef.current = next;
    setScreenState(next);
  }, []);

  return [screen, setScreen] as const;
}
