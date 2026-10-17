/** True when a menu target (path plus optional query) matches the current location. */
export function matchesLocation(to: string, pathname: string, search: string) {
  const [path, query] = to.split('?');
  if (pathname !== path) return false;
  if (!query) return true;
  const target = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  return [...target.entries()].every(([key, value]) => current.get(key) === value);
}

/**
 * A menu item that should also light up for a wider set of pages than its own link, e.g.
 * "Invoices & quotes" (links to tab=invoices) for every tab of the finance tool.
 */
export interface NavAlias { to: string; alsoMatches: string }

/**
 * The one menu target to highlight: the most specific match wins, where an alias counts with the
 * specificity of its `alsoMatches` pattern. So an item linking straight to the current tab
 * (Expenses → tab=expenses) still beats the alias, and the alias beats a bare "/business-tools".
 */
export function activeNavTarget(targets: string[], pathname: string, search: string, aliases: NavAlias[] = []): string | undefined {
  const candidates = [
    ...targets.filter((to) => matchesLocation(to, pathname, search)).map((to) => ({ to, weight: to.length })),
    ...aliases.filter((a) => matchesLocation(a.alsoMatches, pathname, search)).map((a) => ({ to: a.to, weight: a.alsoMatches.length })),
  ];
  return candidates.sort((x, y) => y.weight - x.weight)[0]?.to;
}
