// Why: bulk Zellij deletion returns partial results to preload, runtime RPC,
// and renderer callers without importing main-process types.
export type ZellijSessionDeleteResult = {
  deleted: string[]
  failed: { name: string; error: string }[]
}
