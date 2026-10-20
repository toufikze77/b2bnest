export const FUNCTIONS_DIR: string;
export function prefixFor(dir: string): string;
export function flattenFunction(name: string, functionsDir?: string): Record<string, string>;
