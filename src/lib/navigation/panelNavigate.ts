export async function panelNavigate(href: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.location.assign(href);
}
