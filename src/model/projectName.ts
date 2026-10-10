export const DEFAULT_PROJECT_NAME = 'Release-Management'

/** Keeps the export file name within what file systems accept. */
export const MAX_PROJECT_NAME_LENGTH = 100

const DISALLOWED = /[^A-Za-z0-9._-]/g
const VALID = /^[A-Za-z0-9._-]+$/

/** Project names end up in file names, so only `A-Z a-z 0-9 - _ .` are allowed. Must not be empty. */
export function isValidProjectName(name: string): boolean {
  return name.length <= MAX_PROJECT_NAME_LENGTH && VALID.test(name)
}

/** Drops every disallowed character and cuts to the maximum length (result may be empty). */
export function sanitizeProjectName(input: string): string {
  return input.replace(DISALLOWED, '').slice(0, MAX_PROJECT_NAME_LENGTH)
}
