# Hackathon Frontend Starter — Expo SDK 57 + React Native + NativeWind

> **Purpose:** A reusable, project-agnostic setup for rapid mobile app development during a hackathon. Includes a working Expo Router tab navigator, NativeWind styling, npm workspace layout, and iPhone/Windows LAN troubleshooting.
>
> **Last reviewed:** October 8, 2026. **Target:** Expo SDK 57, NativeWind 4.2.7, Tailwind CSS 3.4.x. These are the versions used for our tested starter; newer releases may require different steps.
>
> **Already working?** Keep your existing project as-is. This guide is also a reproducible checklist for a fresh repo. Don't rerun package upgrades or overwrite generated config files unnecessarily.

## Contents

1. Prerequisites and target stack
2. Create the monorepo and Expo frontend directly in `frontend/`
3. Verify SDK and Expo Router
4. Install and configure NativeWind
5. TypeScript and CSS declaration files
6. Preserve and test Expo Router navigation
7. Verify the frontend on an iPhone
8. Everyday development commands
9. Final file structure and checklist
10. **Troubleshooting: Expo Go, Private Wi-Fi, Windows Firewall, LAN**

---

## 1. Prerequisites and target stack

- **Windows 10/11** with PowerShell and VS Code (or another editor)
- **Node.js + npm** installed (`node -v`, `npm -v`)
- **An iPhone with Expo Go** (or an Android phone with Expo Go)
- Laptop and phone on the **same trusted Wi-Fi** when using LAN mode
- A stable internet connection for initial package installation

| Layer | Technology | Notes |
| --- | --- | --- |
| Mobile framework | Expo SDK 57 + React Native | Expo Go for physical-phone testing |
| Language | TypeScript | From Expo's default template |
| Navigation | Expo Router | Default template includes file-based navigation and tabs |
| Styling | NativeWind **4.2.7** | Tailwind-like `className` support |
| CSS engine | Tailwind CSS **3.4.x** | Compatible with NativeWind v4 |
| Animation support | Reanimated + Worklets | Install Expo-compatible versions |
| Workspace | npm workspaces | Expo lives under `frontend/` |

**Important:** Select the **default** Expo template (or a tabs template), not `blank`, so you keep navigation. NativeWind v4 uses Tailwind v3. Don't mix these files with a NativeWind v5/Tailwind v4 tutorial.

## 2. Create the monorepo with Expo inside `frontend/`

Create a fresh workspace in PowerShell:

```powershell
cd C:\Users\Huawei\Desktop\my-projects
mkdir hackathon-starter
cd hackathon-starter
code .
```

Create **`hackathon-starter/package.json`**:

```json
{
  "name": "hackathon-workspace",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["frontend"],
  "scripts": {
    "dev:frontend": "npm run start --workspace=frontend",
    "check:frontend": "npm exec --workspace=frontend -- tsc --noEmit"
  }
}
```

Generate Expo **directly inside** the `frontend/` directory:

```powershell
npx create-expo-app@latest frontend
```

If prompted, **select Expo SDK 57 and the default TypeScript + Expo Router template**. Don't run `reset-project`: it moves the sample navigation away and isn't needed for this starter.

```powershell
cd frontend
npm ls expo
```

The `expo` package should be `57.x.x` for this tested setup. Expo's generator may target a newer SDK in the future; check the version rather than assuming it always generates 57.

**Only if an existing project was generated with an incompatible older SDK**, our previous upgrade path was:

```powershell
npm install expo@^57.0.0
npx expo install --fix
```

Don't run those upgrade commands on an already-working SDK 57 project.

## 3. Verify Expo Router and the frontend package

The default Expo template should already configure routing, including a root layout and tabs. Check **`frontend/package.json`** contains:

```json
"main": "expo-router/entry"
```

It should also have a `start` script such as:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web"
}
```

These are *snippets*, not complete replacements for your existing `package.json`; preserve all generated dependencies and scripts.

**Why `main` matters:** Without `expo-router/entry`, Metro may fall back to the legacy Expo `App.tsx` entry and report `Unable to resolve "../../App"`.

Route locations vary with the template: `frontend/src/app/` **or** `frontend/app/`. This guide's paths assume `src/app/`. Use your actual folder location.

## 4. Install NativeWind v4 and configure styling

From the **`frontend/`** folder:

```powershell
npm install nativewind@4.2.7
npx expo install react-native-reanimated react-native-worklets react-native-safe-area-context
npm install -D tailwindcss@^3.4.17 babel-preset-expo
npx tailwindcss init
```

Optional local storage for hackathon apps that need persistence/offline preferences:

```powershell
npx expo install @react-native-async-storage/async-storage
```

Prefer `npx expo install` for Expo-compatible native dependencies. Do not blindly run `npm audit fix --force`, which can install incompatible or breaking versions.

### `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

If your generated project uses `app/` instead of `src/app/`, update `content` to include the real paths, for example:

```javascript
content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
```

Add project colors to `theme.extend.colors` **after** you know the hackathon challenge; the starter should remain brand-neutral.

### `frontend/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `frontend/babel.config.js`

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

For **NativeWind v4**, `nativewind/babel` goes under **`presets`**.

### `frontend/metro.config.js`

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
});
```

Expo detects modern npm workspaces automatically. You do **not** need extra `watchFolders`, `extraNodeModules`, or custom node_modules paths for a standard SDK 57 monorepo.

### `frontend/app.json`

Keep the app config generated by Expo and make sure it has the Metro bundler setting:

```json
{
  "expo": {
    "web": { "bundler": "metro" }
  }
}
```

**Merge only `web.bundler` into your existing `expo` object.** Do not replace the entire generated `app.json` with this small illustrative snippet: that would remove valid app identifiers, icon/splash settings, and plugins.

If Expo Doctor reports unsupported older config fields such as `newArchEnabled` or `android.edgeToEdgeEnabled` for your installed SDK version, remove only the invalid properties reported by the validator.

## 5. TypeScript and CSS declarations

Create **`frontend/nativewind-env.d.ts`**:

```typescript
/// <reference types="nativewind/types" />
```

Create **`frontend/global.d.ts`** (helps TypeScript recognize CSS imports):

```typescript
declare module "*.css";
```

Keep Expo's generated `tsconfig.json` unless you have a specific error. If you use `src/` and want `@/` imports, its relevant portion can look like:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "*.d.ts", ".expo/types/**/*.ts"]
}
```

Don't overwrite additional working compiler options from the generated file. If you ran a project reset earlier and kept an `app-example/` backup, exclude that backup from TypeScript compilation when it causes irrelevant type errors.

## 6. Preserve Expo Router's default navigation

**Do not delete the existing `(tabs)` directory.** The default template includes working bottom-tab navigation.

A normal structure is:

```text
frontend/
└── src/
    └── app/
        ├── _layout.tsx
        └── (tabs)/
            ├── _layout.tsx
            ├── index.tsx
            └── ...other generated screens
```

Add the NativeWind stylesheet import at the **top** of the existing **`frontend/src/app/_layout.tsx`**:

```tsx
import "../../global.css";
```

**If your app is `frontend/app/_layout.tsx` instead**, import `"../global.css"`.

**Preserve the rest of the default layout** (including its providers, fonts and navigation). Don't rewrite it just to add NativeWind.

The `(tabs)/_layout.tsx` file declares the tab navigator. Each screen needs an actual route file such as `(tabs)/index.tsx` or `(tabs)/settings.tsx`. A tab layout without screens won't give you functional navigation.

### Quick styling test

Edit the existing Home screen by adding a test element inside its component's JSX (use `View` and `Text` imports from `react-native`):

```tsx
<View className="rounded-2xl bg-emerald-100 p-5">
  <Text className="text-lg font-bold text-emerald-900">
    NativeWind is working!
  </Text>
</View>
```

If the background and text styles show up, NativeWind is working. Remove the test element when done.

## 7. Install, verify, and run

From `frontend/`:

```powershell
npx expo install --check
npx expo-doctor@latest
npx tsc --noEmit
```

Resolve actual diagnostics rather than installing everything again.

From the **monorepo root**:

```powershell
cd ..
npm install
npm run dev:frontend
```

Scan the QR code in Expo Go on your phone. For a clean startup after config changes:

```powershell
cd frontend
npx expo start --go --lan --clear
```

> **Fast Refresh:** Once Metro is running, saving `.tsx` files in VS Code normally refreshes the app automatically. You don't need to restart Expo for every UI change. Restart it after modifying Babel/Metro/Tailwind configuration or diagnosing stale caches.

If the default navigation disappears after editing routes, check that your Home is **inside** `(tabs)/index.tsx`, that `(tabs)/_layout.tsx` exports a `Tabs` layout, and that `package.json` uses `"main": "expo-router/entry"`.

## 8. Everyday hackathon commands

Run these from the **monorepo root** unless otherwise noted:

| Task | Command |
| --- | --- |
| Start frontend | `npm run dev:frontend` |
| Type-check frontend | `npm run check:frontend` |
| Check Expo dependencies | `cd frontend; npx expo install --check` |
| Inspect installed SDK | `cd frontend; npm ls expo` |
| Clean-restart Metro | `cd frontend; npx expo start --go --lan --clear` |
| See running Metro status | `curl.exe http://localhost:8081/status` |

**Adding a backend later:** Add a `backend/` folder with its own `package.json`, change root `workspaces` to `["frontend", "backend"]`, and add backend scripts. It is not required for the frontend starter to work.

**Secrets:** Don't put API credentials or database passwords into `EXPO_PUBLIC_` variables; those are bundled into the mobile app.

## 9. Final folder structure and checklist

```text
hackathon-starter/
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── _layout.tsx
│   │       └── (tabs)/
│   │           ├── _layout.tsx
│   │           ├── index.tsx
│   │           └── ...
│   ├── assets/
│   ├── app.json
│   ├── babel.config.js
│   ├── global.css
│   ├── global.d.ts
│   ├── metro.config.js
│   ├── nativewind-env.d.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── package.json          # npm workspaces
├── package-lock.json     # root lockfile after npm install
└── node_modules/
```

- [ ] Expo Go opens the frontend on a physical phone
- [ ] Expo SDK and installed dependencies are compatible
- [ ] Bottom-tab navigation works
- [ ] NativeWind classes visibly style the test component
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run dev:frontend` starts the app from the root
- [ ] Project is saved/committed to Git before hackathon work begins

---

# 10. Troubleshooting — Expo Go, Private Wi-Fi, Windows Firewall and LAN

This section records the **actual class of network issue we debugged** during the initial Expo setup. It's **optional** if Expo Go already connects successfully. Don't relax firewall rules on untrusted networks.

## A. Typical symptoms

```text
Request timed out
```

Or:

```text
Tunnel connected.
CommandError: ngrok tunnel took too long to connect.
```

Or the Expo QR opens, but the mobile app cannot load JavaScript from Metro.

In our earlier test, both laptop and phone were on the same Wi-Fi, but Windows had classified the laptop Wi-Fi connection as **Public**. We also had Cloudflare WARP and Tailscale virtual adapters. The later SDK mismatch was **a separate issue**; we cannot attribute the initial timeout to one definitive cause.

## B. Check laptop and phone are on the same network

On Windows PowerShell:

```powershell
ipconfig
```

Look for the **IPv4 Address** of your actual Wi-Fi adapter. On the iPhone, go to **Settings → Wi-Fi → (i) next to the connected network** and look for **IP Address**.

Historical *example* from our earlier troubleshooting:

| Device | Historical LAN IP |
| --- | --- |
| Laptop | `192.168.18.7` |
| iPhone | `192.168.18.29` |
| Router subnet mask | `255.255.255.0` |

Your current addresses may differ. Check that both devices are on the same LAN, not a guest network with device isolation.

## C. Check Windows Wi-Fi network profile

```powershell
Get-NetConnectionProfile | Format-Table Name, InterfaceAlias, InterfaceIndex, NetworkCategory
```

Look for the profile matching your **trusted home/hackathon Wi-Fi**. If it says `Public`, Windows might be blocking unsolicited LAN connections.

To change **only a trusted network** to `Private`, open **PowerShell as Administrator**:

```powershell
Set-NetConnectionProfile -InterfaceIndex <YOUR_WIFI_INTERFACE_INDEX> -NetworkCategory Private
```

Replace `<YOUR_WIFI_INTERFACE_INDEX>` with the actual number shown by `Get-NetConnectionProfile`. For example, our earlier machine had index `8`, but that is **not guaranteed to remain the same**.

Verify:

```powershell
Get-NetConnectionProfile
```

**Security:** Keep coffee-shop, airport, hotel, or unknown Wi-Fi networks set to `Public`. Do not disable Windows Firewall.

## D. Start Metro in LAN mode and test it

From **`frontend/`**:

```powershell
npx expo start --go --lan
```

Keep Metro running. In a second terminal:

```powershell
curl.exe --max-time 10 http://localhost:8081/status
```

Expected:

```text
packager-status:running
```

Next test your actual laptop IPv4:

```powershell
curl.exe --max-time 10 http://<LAPTOP_IPV4>:8081/status
```

Replace `<LAPTOP_IPV4>` with your current address, e.g. `192.168.18.7` from the old setup.

Finally, open this address in **iPhone Safari** (using current IP and Metro port):

```text
http://<LAPTOP_IPV4>:8081/status
```

**Note:** Metro normally uses `8081`, but if the terminal reports a different port, substitute that port.

| Result | What to investigate |
| --- | --- |
| `localhost` fails | Metro not started, crashed or using another port |
| `localhost` works, laptop-IP fails | Local network binding, VPN, or Windows configuration |
| Laptop-IP works on PC, Safari times out | Firewall rule, device isolation, guest Wi-Fi, VPN routing |
| Safari works, Expo Go fails | SDK mismatch, QR/deep-link route, Expo Go cache |

## E. Add a *restricted* Windows Firewall rule for Metro

Only if Safari cannot access Metro and you're on a **trusted Private Wi-Fi** network, first check whether the rule exists:

```powershell
Get-NetFirewallRule -DisplayName "Hackathon Expo Metro" -ErrorAction SilentlyContinue
```

In **PowerShell as Administrator**, substitute the **current iPhone IP** for `<IPHONE_IPV4>`:

```powershell
New-NetFirewallRule `
  -DisplayName "Hackathon Expo Metro" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8081 `
  -RemoteAddress <IPHONE_IPV4> `
  -Action Allow `
  -Profile Private
```

This permits TCP traffic to port `8081` **only from that iPhone address on Private networks**. Use the actual Metro port if it changed. Avoid a broad firewall exception for all remote addresses.

Once the event is over, if you no longer need the rule, remove it in an elevated PowerShell window:

```powershell
Remove-NetFirewallRule -DisplayName "Hackathon Expo Metro"
```

## F. Inspect VPNs and network isolation

- Temporarily disconnect **Cloudflare WARP / Tailscale** while testing LAN; reconnect them afterward.
- Avoid **guest Wi-Fi** or router settings that isolate clients from each other.
- If the laptop is on Ethernet and the phone is on Wi-Fi, verify the router allows communication across those segments.
- On iOS, grant the relevant app permission to access the **Local Network** if prompted.
- If the iPhone changed IP addresses via DHCP, update the rule's allowed remote address instead of disabling the firewall.

## G. Tunnel as a fallback

If LAN is blocked by an event venue's Wi-Fi policy, try:

```powershell
npx expo start --go --tunnel
```

Tunnel mode depends on the tunnel provider/network and can be slower or time out. We previously saw an Ngrok timeout, so it should not be considered a guaranteed fix. Try another trusted network/hotspot if event Wi-Fi uses client isolation.

## H. SDK mismatch is not a Wi-Fi failure

If Expo Go displays something like:

```text
Expo Go is for SDK 57, but the project uses SDK 54.
```

The phone has already reached enough of Expo's connection flow to detect the version mismatch. Check the SDK:

```powershell
npm ls expo
npx expo install --check
```

Match the app SDK to the Expo Go release. In our earlier setup, we upgraded the project to SDK 57 and ran `npx expo install --fix`. Don't change Windows Firewall settings to resolve an SDK mismatch.

## I. Quick recovery order during the hackathon

1. Check Metro is running and note its actual port.
2. Verify laptop and phone are on the same trusted network.
3. Test `/status` from Windows `localhost`, Windows LAN IP, then iPhone Safari.
4. Inspect VPN routing and Wi-Fi guest/client isolation.
5. Check the Windows network profile and use a **restricted** firewall rule only if necessary.
6. If the app loads but errors, inspect the Metro terminal; check the Expo SDK, app routes, and NativeWind config.
7. After configuration fixes, restart once with `npx expo start --go --lan --clear`.

---

## Official documentation

- [Expo — Create a project](https://docs.expo.dev/get-started/create-a-project/)
- [Expo — create-expo-app templates](https://docs.expo.dev/more/create-expo/)
- [Expo — TypeScript](https://docs.expo.dev/guides/typescript/)
- [Expo — Work with monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo Router — Installation](https://docs.expo.dev/router/installation/)
- [Expo Router — Tabs](https://docs.expo.dev/router/advanced/tabs/)
- [NativeWind — Installation (v4)](https://www.nativewind.dev/docs/getting-started/installation)

**End of guide.** Save this as your generic starter reference. Keep project-specific app screens, assets, and branding separate from the reusable setup.
