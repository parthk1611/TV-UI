# Install TV Home on the Samsung TV (from a Mac)

Target: Samsung Q60A (QN65Q60AAFXZC, 2021, Tizen 6.0). Computer: a MacBook running macOS.

Each step cites the page it was checked against on 2026-10-24. Anything marked
**Unverified** was not confirmed in Samsung or Tizen documentation; treat it as a best guess
and check it as you go. The prior ZIP was signed with TVProfile, installed and launched successfully on this Mac and TV on October 24, 2026. Individual feature behavior still needs TV verification.

You need: the Mac and the TV on the same network, a free Samsung Developers account
(for the certificate), and about an hour the first time.

## 1. Install Tizen Studio on the Mac

1. Download the **IDE installer for macOS**: `web-ide_Tizen_Studio_6.1_macos-64.dmg` from
   <https://download.tizen.org/sdk/Installer/tizen-studio_6.1/> (directory listing fetched; 6.1 was
   the newest Tizen Studio folder there). The old download page `developer.tizen.org/development/tizen-studio/download`
   now redirects to the Tizen OS portal, whose Tools page (<https://samsungtizenos.com/tools-download/>)
   lists the new "Tizen SDK 10" CLI installer and VS Code extension rather than this IDE.
   Samsung's TV guide still uses Tizen Studio, so this guide does too.
2. Open the `.dmg`, then **Control-click (right-click) the installer → Open**. Samsung's macOS
   install note says double-clicking can fail because the installer is not notarized, and that
   opening it from the context menu avoids that
   ([Samsung blog, 2021](https://developer.samsung.com/sdp/blog/en/2021/11/02/installing-tizen-studio-on-the-latest-macos-and-avoiding-notarization)).
   The same note suggests `sudo spctl --master-disable` if it still will not open. That turns off
   Gatekeeper for the whole Mac, so try it only as a last resort and turn it back on afterwards with
   `sudo spctl --master-enable`. **Unverified:** whether this still works the same on current macOS versions.
3. Accept the licence, keep the default location (`~/tizen-studio`, data in `~/tizen-studio-data`),
   click **Install**, and tick **Launch the Package Manager** before clicking **Finish**
   ([Samsung: Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)).
   If the installer will not start, Samsung's note says to delete `~/.package-manager/jdk/` and try again.
   No separate Java install is needed: Java has been bundled since Tizen SDK 3.7
   ([Tizen prerequisites](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/setup/prerequisites.md)).

**Apple Silicon (M1/M2/M3/M4) Macs: Rosetta 2. Unverified.** Neither Samsung nor Tizen documents
Apple Silicon support. The installer is named `macos-64`, and third-party guides say Tizen Studio's tools
(`sdb`, `tizen`, the bundled Java) are Intel-only and run through Rosetta 2. If macOS asks to install
Rosetta when you open the installer, accept. You can also install it ahead of time:

```sh
softwareupdate --install-rosetta --agree-to-license
```

(To check your chip: Apple menu → About This Mac. "Chip: Apple M…" means Apple Silicon.)

Tizen's prerequisites page lists macOS 11.4 (Big Sur) and 12.3 (Monterey) as the supported versions.
**Unverified:** whether newer macOS versions work. Samsung's TV Device page says that if Tizen Studio
freezes on macOS, you should update the Java Development Kit.

## 2. Add the Samsung TV extensions

In the **Package Manager**, open the **Extension SDK** tab and click **install** next to
**TV Extensions** (choose the Tizen 6.0 one if several are listed) and **Samsung Certificate Extension**.
Accept the licences and wait
([Samsung: Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)).
Samsung notes that certificate versions before 2.0.73 cannot create certificates after September 2025,
so install or update to the latest Samsung Certificate Extension.

To reopen the Package Manager later: it is at `~/tizen-studio/package-manager/` (**Unverified:** the
exact name of the Mac app in that folder. Samsung's page only gives the Windows `package-manager.exe`).

## 3. Put the command-line tools on your PATH

Tizen's CLI page says the `tizen` command is in `<TIZEN_SDK>/tools/ide/bin/`
([Tizen CLI](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/common-tools/command-line-interface.md)),
and Samsung's FAQ says `.wgt` builds fail unless that folder is on `PATH`
([Samsung Tizen Studio Q&A, Q11](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html)).
`sdb` is in `~/tizen-studio/tools` (**Unverified** in the docs. Third-party guides use that path).
macOS uses zsh by default, so add both folders to `~/.zshrc`:

```sh
echo 'export PATH="$HOME/tizen-studio/tools:$HOME/tizen-studio/tools/ide/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
which tizen sdb      # both should print a path under ~/tizen-studio
```

## 4. Find your Mac's IP address

Apple menu → **System Settings** → **Network** → **Wi-Fi** → **Details** → **TCP/IP**. The IP
address is shown there
([Apple: Change TCP/IP settings on Mac](https://support.apple.com/guide/mac-help/change-tcpip-settings-on-mac-mh14129/mac)).
From Terminal you can also use:

```sh
ipconfig getifaddr en0
```

(**Unverified:** that Wi-Fi is `en0` on your MacBook. It usually is. If this prints nothing, use the System Settings path.)

Tip: give the Mac a fixed (reserved) address in your router, because Developer Mode is tied to it.

## 5. Turn on Developer Mode on the TV

From [Samsung: TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html):

1. On the TV, open **Smart Hub** and select the **Apps** panel. (The page also says to scroll down to
   **App Settings**. **Unverified:** whether the 2021 menus show it under that name.)
2. Enter **12345** with the remote or the on-screen number pad. The Developer mode popup appears.
3. Switch **Developer mode** to **On**, enter your **Mac's IP** from step 4, and select **OK**.
4. **Restart the TV**. "Develop Mode" now shows at the top of the Apps panel.

Find the TV's own IP under the TV's network settings (**Unverified:** the exact menu path on the Q60A).

## 6. Connect and read the TV's DUID

```sh
sdb connect <TV_IP>      # port 26101 is used by default
sdb devices              # note the name in the last column: that is the target name for tizen install
```

The `sdb connect`/`devices` commands are from
[Tizen SDB docs](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/common-tools/smart-development-bridge.md).
You can also connect from Tizen Studio: **Tools → Device Manager → Remote Device Manager → +**, enter
the TV's IP, then switch **Connection** to **On** (Samsung TV Device page).

Read the DUID (device ID) for the certificate. Either:

- in the Certificate Manager wizard (step 7), click **+** next to the connected TV and it fills it in, or
- read it on the TV: **Menu → Support → Contact Samsung → Unique Device ID** (both are from
  [Samsung: Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html)), or
- `sdb shell 0 getduid`. **Unverified:** this command is not in Samsung's docs. It comes from
  several third-party TV guides.

## 7. Create the Samsung certificate profile

From [Samsung: Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html):

1. In Tizen Studio: **Tools → Certificate Manager**. Click **Cancel** on the migration dialog if it appears.
2. Click **+** → **Samsung** → **TV** → **Next**. Name the profile, for example `TVHome`.
3. **Create a new author certificate**, fill in the details, **sign in with your Samsung Developers
   account**, and choose a backup folder. **Back these files and passwords up somewhere safe, outside
   this project.** Every future update must be signed with the same author certificate, or the TV will
   treat it as a different app.
4. **Create a new distributor certificate**, keep the **Public** privilege level (this app only uses
   public privileges), and add the TV's **DUID**. Click **Finish**.

Never commit `.p12` files or passwords. `.gitignore` already blocks `*.p12`, `*.pem`, `*.key`, and `.sign/`.

## 8. Build, sign and install

The following update sequence was verified on this Mac and QN65Q60AAFXZC on October 24, 2026, using Tizen CLI 2.5.25, SDB 4.2.36, and the existing `TVProfile` signing profile. Run it from the repository root:

```sh
./scripts/build-wgt.sh
tizen security-profiles list
tizen package -t wgt -s TVProfile -- "$PWD/dist/TVHome"
tizen install -n TVHome.wgt -t QN65Q60AAFXZC -- "$PWD/dist/TVHome"
tizen run -p TvHome0001.TVHome -t QN65Q60AAFXZC
```

The staging allow-list includes `fonts/`, so the TV gets the same locally bundled typeface and license as the preview. Signing produces `dist/TVHome/TVHome.wgt`. This plain static project was packaged directly from its staging folder; no `tizen build-web` step was needed in the verified sequence. Use your own target/profile names on another machine.

Version 0.3.0 was signed with the same author certificate as the installed 0.2.0 ZIP, installed over that app without uninstalling, and launched successfully. This establishes installation and launch, not the correctness of every TV feature or whether the TV retained all saved preferences. Check those on the device after updating.

The unsigned `dist/TVHome-unsigned.wgt` is for inspection only. The TV will not install it until it
is signed with your Samsung profile, and that profile needs your Samsung account and your TV's DUID,
which only you can provide.

Alternatively, in the Tizen Studio GUI, use **File → Import → Tizen → Tizen project → Select archive file**,
choose `dist/TVHome-unsigned.wgt`, pick the TV platform, then **Run As → Tizen Web Application** with the
TV connected ([Samsung Tizen Studio Q&A](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html),
[Samsung: TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)).
**Unverified** for an unsigned archive.

If the install fails with **1010: App install fail**, Samsung says the usual cause is the certificate
(check the DUID and the active profile). If the TV menus refuse the install, Samsung's FAQ suggests
**Device Manager → right-click the TV → Permit to install applications**.

## 9. Open it

After installing, open **TV Home** from the Samsung home bar / Apps panel. It does not replace the Samsung
Home button (not supported). Do not reset Smart Hub.

## 10. Updating later

1. Pull the latest code, then rerun step 8 with the **same certificate profile**.
2. Install over the existing app. **Don't uninstall first**: uninstalling deletes the app's saved
   settings (wallpaper, city, tile order, websites). Samsung's FAQ says the TV removes the old version
   automatically when you install a new one
   ([Samsung: TV Device, Q&A](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)).
   **Unverified:** whether localStorage survives that automatic replacement. Check that your settings
   are still there after the first update.
3. Optionally raise `version` in `config.xml` (format x.y.z). Never change the app ID `TvHome0001.TVHome`
   or package ID `TvHome0001`.

## Certificate expiry and re-signing

Signed packages need a valid certificate. To renew, create a new certificate profile in Certificate
Manager and choose **Select an existing author certificate** with your saved `author.p12` and password
([Samsung Tizen Studio Q&A, Q7](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html)).
If the TV's DUID changes (for example after a board replacement), you need a new distributor certificate
with the new DUID. **Unverified:** how long Samsung TV certificates stay valid. Check the dates shown in
Certificate Manager.

## What the app needs from the TV (config.xml)

- Network access is limited to `https://api.open-meteo.com` and `https://geocoding-api.open-meteo.com`.
  Samsung's config page says web apps cannot reach network resources without an access entry (WARP)
  ([Samsung: Configuring Web Applications](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html)).
- Website tiles open in the TV's own browser through a Tizen application control. That is an app launch,
  not a request from TV Home, so it should need no `<access>` entry. **Unverified on the TV.**
- Privileges: internet, application.launch, application.info, tv.inputdevice (all public).

## Sources fetched for this guide (2026-10-24)

- Samsung: [Installing TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html), [TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), [Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html), [Tizen Studio Q&A](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html), [Configuring Web Applications](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html), [Keyboard/IME](https://developer.samsung.com/smarttv/develop/guides/user-interaction/keyboardime.html), [macOS install blog](https://developer.samsung.com/sdp/blog/en/2021/11/02/installing-tizen-studio-on-the-latest-macos-and-avoiding-notarization)
- Tizen docs source (docs.tizen.org renders client-side, so the Markdown sources were read from Samsung's
  `tizen-docs` GitHub repository): [CLI](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/common-tools/command-line-interface.md), [SDB](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/common-tools/smart-development-bridge.md), [Prerequisites](https://github.com/Samsung/tizen-docs/blob/master/docs/sdk-tools/baseline-sdk/setup/prerequisites.md), [Web app controls](https://github.com/Samsung/tizen-docs/blob/master/docs/application/web/guides/app-management/app-controls.md)
- Downloads: <https://download.tizen.org/sdk/Installer/tizen-studio_6.1/>
- Apple: [Change TCP/IP settings on Mac](https://support.apple.com/guide/mac-help/change-tcpip-settings-on-mac-mh14129/mac)
