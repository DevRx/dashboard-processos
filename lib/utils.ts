import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively converts all snake_case keys in an object or array to camelCase.
 * This is used to normalize Supabase responses (which use snake_case) to
 * match the camelCase convention expected by the frontend.
 */
export function toCamelCase<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as T
  }
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      )
      ;(acc as Record<string, unknown>)[camelKey] = toCamelCase(
        (obj as Record<string, unknown>)[key]
      )
      return acc
    }, {} as T)
  }
  return obj
}

/**
 * Recursively converts all camelCase keys in an object or array to snake_case.
 * This is used to normalize JS/validated-form objects (camelCase) before
 * writing them to Supabase (which expects snake_case column names).
 */
export function toSnakeCase<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase) as T
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      ;(acc as Record<string, unknown>)[snakeKey] = toSnakeCase(
        (obj as Record<string, unknown>)[key]
      )
      return acc
    }, {} as T)
  }
  return obj
}