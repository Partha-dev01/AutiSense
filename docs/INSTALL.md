# Installing AutiSense

AutiSense runs anywhere a modern browser does, and ships as installable apps for
Windows, macOS, Linux, and Android. **Every native app is a thin client** that
loads the live site (`https://autisense.imaginaerium.in`), so once installed it
stays current automatically with each web deploy.

- [Web (no install)](#web-no-install)
- [Install as a PWA](#install-as-a-pwa)
- [Native apps](#native-apps)
  - [Windows](#windows)
  - [macOS](#macos)
  - [Linux](#linux)
  - [Android](#android)
- [Why the security warnings?](#why-the-security-warnings)

---

## Web (no install)

Just open the app:

**https://autisense.imaginaerium.in**

A camera is required for the screening features; the browser will request
permission. All screening pose/behavior analysis runs on your device — frames are
not uploaded.

---

## Install as a PWA

AutiSense is a Progressive Web App with an offline app shell.

- **Desktop Chrome / Edge:** open the site and click the **Install** icon in the
  address bar (or browser menu → *Install AutiSense*).
- **Android Chrome:** menu → **Add to Home screen / Install app**.
- **iOS Safari:** Share → **Add to Home Screen**.

The installed PWA launches full-screen without browser chrome.

---

## Native apps

Download from the
[**Releases**](https://github.com/Partha-dev01/AutiSense/releases) page. The
latest is
[**v1.1.0**](https://github.com/Partha-dev01/AutiSense/releases/tag/v1.1.0).

| Platform | File |
|---|---|
| Windows | `AutiSense-Setup-1.1.0.exe` |
| Linux (portable) | `AutiSense-1.1.0.AppImage` |
| Linux (Debian/Ubuntu) | `autisense-desktop_1.1.0_amd64.deb` |
| macOS (Apple Silicon) | `AutiSense-1.1.0-arm64.dmg` |
| Android | `app-release-signed.apk` (and `.aab` for Play) |

> **Heads-up:** all installers are currently **unsigned** (no paid code-signing
> certificates). Your OS will likely warn on first open. The steps below are safe
> and only needed once. See [Why the security warnings?](#why-the-security-warnings).

---

### Windows

1. Run `AutiSense-Setup-1.1.0.exe` (NSIS installer — you can choose the install
   location).
2. If **Windows SmartScreen** appears ("Windows protected your PC"), click
   **More info**, then **Run anyway**.
3. Complete the installer and launch AutiSense.

The desktop app opens the live site in a secure window; external links open in
your default browser. Sign-in with Google opens in your system browser and
returns to the app automatically.

---

### macOS

> macOS builds target **Apple Silicon (arm64) only**.

Because the app is unsigned and downloaded from the internet, macOS **Gatekeeper**
quarantines it. On Apple Silicon this commonly surfaces as
**"AutiSense is damaged and can't be opened. You should move it to the Trash."**
This is *not* real damage — it's the quarantine flag on an unsigned download.

1. Open the `.dmg` and drag **AutiSense** into **Applications**.
2. Open **Terminal** and clear the quarantine attribute:
   ```bash
   xattr -cr /Applications/AutiSense.app
   ```
3. Launch AutiSense from the Applications folder.
4. **If it still won't open**, ad-hoc code-sign it locally and try again:
   ```bash
   codesign --force --deep --sign - /Applications/AutiSense.app
   ```

**Why this is needed:** Gatekeeper refuses to run unsigned, quarantined apps.
`xattr -cr` removes the quarantine metadata; the ad-hoc `codesign` gives the
bundle a local (self) signature so Gatekeeper will load it. The proper long-term
fix is an **Apple Developer ID certificate + notarization**, which is planned but
not yet in place.

---

### Linux

**AppImage (portable, no install):**
```bash
chmod +x AutiSense-1.1.0.AppImage
./AutiSense-1.1.0.AppImage
```
If your distro needs FUSE for AppImages and it's missing, install it
(`sudo apt install libfuse2` on Debian/Ubuntu) or run with
`--appimage-extract-and-run`.

**Debian / Ubuntu (.deb):**
```bash
sudo dpkg -i autisense-desktop_1.1.0_amd64.deb
# if dependencies are missing:
sudo apt-get install -f
```
The app appears in your application launcher afterward.

---

### Android

The Android app is a **Trusted Web Activity (TWA)** that opens the PWA
full-screen via your device's Chrome engine, with no browser address bar (the
domain is verified through Digital Asset Links; if verification doesn't pass,
Android falls back to a Custom Tab that shows the URL bar).

1. Download `app-release-signed.apk` onto the device.
2. When prompted, allow **install from unknown sources** for the browser or file
   manager you're using (Settings → Apps → *special access* → *Install unknown
   apps*).
3. Open the APK to install, then launch AutiSense.

> The `.aab` (Android App Bundle) is intended for Google Play distribution, not
> direct sideloading.

---

## Why the security warnings?

Operating systems trust apps that are signed with a recognized developer
certificate. AutiSense's installers are **not yet signed** (paid certificates and
notarization aren't set up), so:

- **Windows** shows SmartScreen because the publisher reputation is unknown.
- **macOS** quarantines and may report the app as "damaged" because there's no
  Developer ID signature or notarization ticket.
- **Android** requires you to permit installs from unknown sources because the
  APK isn't coming from the Play Store.

These are expected for an unsigned open-source build. The planned fixes are
proper code-signing on Windows, an Apple Developer ID + notarization on macOS,
and Play Store distribution on Android. Until then, the steps above are the
supported way to install.

If you'd rather avoid native installers entirely, just use the
[web app](https://autisense.imaginaerium.in) or [install the PWA](#install-as-a-pwa).
