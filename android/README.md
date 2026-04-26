# DâuPhim Android APK

This folder contains a small native Android WebView wrapper for the static DâuPhim site.

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
