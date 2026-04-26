# DâuPhim Android APK

This folder contains a small native Android WebView wrapper for the DâuPhim site.

The app ships the UI and fallback movie data in APK assets, then loads the movie database from the online URL configured in `video-config.js`. Updating `data.json` online can add movies, episodes, and stream servers without reinstalling the APK.

## Build

Install Android SDK command-line tools and packages:

```bash
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Then build:

```bash
ANDROID_HOME=/path/to/android-sdk android/build-apk.sh
```

Output:

```text
android/dist/DauPhim.apk
```

The build script copies the current web files from the repository root into APK assets, compiles the Java WebView activity, aligns the APK, signs it with a local internal keystore under `android/build/`, and verifies the signature.
