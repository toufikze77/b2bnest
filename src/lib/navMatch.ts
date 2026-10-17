/** True when a menu target (path plus optional query) matches the current location. */
export function matchesLocation(to: string, pathname: string, search: string) {
  const [path, query] = to.split('?');
  if (pathname !== path) return false;
  if (!query) return true;
  const target = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  return [...target.entries()].every(([key, value]) => current.get(key) === value);
}
