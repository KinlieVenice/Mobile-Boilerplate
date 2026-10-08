# Hackathon Starter

An Expo SDK 57 and React Native frontend with Expo Router and NativeWind. The app is in `frontend/`; the repository root is an npm workspace.

## Requirements

- Node.js and npm
- For a physical phone: Expo Go and a phone on the same Wi-Fi network as your computer
- For an emulator or simulator: the corresponding Android or iOS development tools

## Run the app

Open a terminal in the repository root and run:

```sh
npm ci
npm run dev:frontend
```

Expo will show a QR code and shortcuts in the terminal. Scan the QR code with Expo Go to open the app on your phone. Keep the terminal running while you work; press `Ctrl+C` to stop it.

To open a specific platform from the repository root, use:

```sh
npm run web --workspace=frontend
npm run android --workspace=frontend
npm run ios --workspace=frontend
```

The Android and iOS commands require an available emulator or simulator. An iOS simulator requires macOS. You can also start `npm run dev:frontend` and choose a platform using the shortcuts shown by Expo.

## Check the project

```sh
npm run check:frontend
npm run lint --workspace=frontend
```

## If your phone cannot connect

Check that your phone and computer are on the same network. If the local connection is blocked, try Expo's tunnel mode from the repository root:

```sh
npm run start --workspace=frontend -- --tunnel
```

For more detailed Windows, firewall, and Expo Go troubleshooting, see the [frontend setup guide](frontend/Hackathon_Expo57_NativeWind_Frontend_Setup.md#10-troubleshooting--expo-go-private-wi-fi-windows-firewall-and-lan).

App routes and screens are under `frontend/src/app/`.
