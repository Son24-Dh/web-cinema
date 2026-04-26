#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-/tmp/dauphim-android-sdk}"
BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.0"
ANDROID_JAR="$ANDROID_HOME/platforms/android-35/android.jar"
APP_DIR="$ROOT_DIR/android/app/src/main"
BUILD_DIR="$ROOT_DIR/android/build"
DIST_DIR="$ROOT_DIR/android/dist"
ASSETS_DIR="$APP_DIR/assets/www"
KEYSTORE="$BUILD_DIR/dauphim-release.keystore"
APK_NAME="DauPhim.apk"

require_file() {
    if [[ ! -e "$1" ]]; then
        echo "Missing required file: $1" >&2
        exit 1
    fi
}

require_file "$BUILD_TOOLS/aapt2"
require_file "$BUILD_TOOLS/d8"
require_file "$BUILD_TOOLS/zipalign"
require_file "$BUILD_TOOLS/apksigner"
require_file "$ANDROID_JAR"

rm -rf "$BUILD_DIR/compiled" "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex"
mkdir -p "$BUILD_DIR/compiled" "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$DIST_DIR" "$ASSETS_DIR"

cp "$ROOT_DIR/index.html" "$ASSETS_DIR/index.html"
cp "$ROOT_DIR/watch.html" "$ASSETS_DIR/watch.html"
cp "$ROOT_DIR/styles.css" "$ASSETS_DIR/styles.css"
cp "$ROOT_DIR/app.js" "$ASSETS_DIR/app.js"
cp "$ROOT_DIR/data.js" "$ASSETS_DIR/data.js"
cp "$ROOT_DIR/video-config.js" "$ASSETS_DIR/video-config.js"

"$BUILD_TOOLS/aapt2" compile --dir "$APP_DIR/res" -o "$BUILD_DIR/compiled/resources.zip"
"$BUILD_TOOLS/aapt2" link \
    -o "$BUILD_DIR/base.apk" \
    -I "$ANDROID_JAR" \
    --manifest "$APP_DIR/AndroidManifest.xml" \
    --java "$BUILD_DIR/gen" \
    -A "$APP_DIR/assets" \
    "$BUILD_DIR/compiled/resources.zip" \
    --auto-add-overlay

javac -source 8 -target 8 \
    -bootclasspath "$ANDROID_JAR" \
    -d "$BUILD_DIR/classes" \
    $(find "$APP_DIR/java" "$BUILD_DIR/gen" -name '*.java' -print)

"$BUILD_TOOLS/d8" \
    --lib "$ANDROID_JAR" \
    --output "$BUILD_DIR/dex" \
    $(find "$BUILD_DIR/classes" -name '*.class' -print)

cp "$BUILD_DIR/base.apk" "$BUILD_DIR/unsigned.apk"
(cd "$BUILD_DIR/dex" && zip -q -r "$BUILD_DIR/unsigned.apk" classes.dex)

"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

if [[ ! -f "$KEYSTORE" ]]; then
    keytool -genkeypair \
        -keystore "$KEYSTORE" \
        -storepass dauphim123 \
        -keypass dauphim123 \
        -alias dauphim \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=DauPhim, OU=Internal, O=Son24, L=Ho Chi Minh, ST=Ho Chi Minh, C=VN"
fi

"$BUILD_TOOLS/apksigner" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:dauphim123 \
    --key-pass pass:dauphim123 \
    --out "$DIST_DIR/$APK_NAME" \
    "$BUILD_DIR/aligned.apk"

"$BUILD_TOOLS/apksigner" verify --verbose "$DIST_DIR/$APK_NAME"

echo "APK built: $DIST_DIR/$APK_NAME"
