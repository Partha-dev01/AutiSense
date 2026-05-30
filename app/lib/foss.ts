/**
 * FOSS build flag.
 *
 * When `NEXT_PUBLIC_FOSS_BUILD=1` is set at build time, the app runs in a
 * self-contained, no-proprietary-services mode (local guest auth instead of
 * Google OAuth, no AWS/DynamoDB/Bedrock/Polly, self-hosted assets) suitable
 * for offline use and open-source app-store packaging (PWA / Snap / Flathub /
 * F-Droid).
 *
 * Unset — the default, including the production Amplify build — evaluates to
 * `false`, so behaviour is byte-for-byte unchanged. `NEXT_PUBLIC_` vars are
 * inlined by Next at build time, so this is a compile-time constant on the
 * client (and readable on the server too).
 */
export const IS_FOSS_BUILD = process.env.NEXT_PUBLIC_FOSS_BUILD === "1";
