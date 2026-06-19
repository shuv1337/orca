// Fork mobile distribution links. Mirror of the desktop
// src/shared/mobile-distribution.ts — keep values in sync in the same PR.
// The fork distributes from shuv1337/orca, NOT upstream stablyai/orca or the
// upstream App Store listing id6766130217 (ADR-0003).

import { FORK_GITHUB_REPO_SLUG } from './product-brand'

/** Fork GitHub releases page — Android APK + general downloads. */
export const FORK_GITHUB_RELEASES_URL = `https://github.com/${FORK_GITHUB_REPO_SLUG}/releases`

/**
 * iOS distribution links. The fork has no public App Store listing yet
 * (Phase 5) and TestFlight is not wired up yet (Phase 4); until then iOS users
 * are pointed at GitHub releases. Set TESTFLIGHT in Phase 4 and APP_STORE in
 * Phase 5.
 */
export const FORK_IOS_TESTFLIGHT_URL: string | null = null
export const FORK_IOS_APP_STORE_URL: string | null = null

/** Best available iOS download/update link for the current phase. */
export function forkIosUpdateUrl(): string {
  return FORK_IOS_APP_STORE_URL ?? FORK_IOS_TESTFLIGHT_URL ?? FORK_GITHUB_RELEASES_URL
}

/** Human label for where the iOS build currently comes from. */
export function forkIosUpdateSource(): string {
  if (FORK_IOS_APP_STORE_URL) {
    return 'the App Store'
  }
  if (FORK_IOS_TESTFLIGHT_URL) {
    return 'TestFlight'
  }
  return 'GitHub Releases'
}

/** Android APK release tag on the fork repo; bumped per mobile release (Phase 4). */
export const FORK_ANDROID_APK_RELEASE_TAG = 'mobile-v0.0.1'

export function forkAndroidApkUrl(tag: string = FORK_ANDROID_APK_RELEASE_TAG): string {
  return `https://github.com/${FORK_GITHUB_REPO_SLUG}/releases/download/${tag}/app-release.apk`
}
