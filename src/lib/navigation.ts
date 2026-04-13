import type { AppPage } from '../types/navigation';

export function pathToPage(pathname: string): AppPage {
  switch (pathname) {
    case '/':
    case '/prs':
      return 'prs';
    case '/overview':
      return 'overview';
    case '/team':
      return 'team';
    case '/api':
      return 'api';
    default:
      return 'prs';
  }
}

export function pageToPath(page: AppPage): string {
  switch (page) {
    case 'prs':
      return '/prs';
    case 'overview':
      return '/overview';
    case 'team':
      return '/team';
    case 'api':
      return '/api';
  }
}

export function isKnownAppPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/prs' || pathname === '/overview' || pathname === '/team' || pathname === '/api';
}
