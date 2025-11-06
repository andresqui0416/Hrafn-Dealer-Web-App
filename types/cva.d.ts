declare module "class-variance-authority" {
  export type VariantProps<T> = Record<string, unknown>;
  export function cva(base?: string, config?: unknown): (...inputs: Array<unknown>) => string;
}
