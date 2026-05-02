# Build Resources

This directory contains application icons and other resources used by electron-builder during packaging.

## Required Icon Files

### Windows

- **File**: `icon.ico`
- **Format**: ICO
- **Size**: 256x256 pixels (minimum)
- **Usage**: Used for Windows installer and application icon

### macOS

- **File**: `icon.icns`
- **Format**: ICNS
- **Size**: Multiple sizes (16x16 to 1024x1024)
- **Usage**: Used for macOS application bundle and DMG

### Linux

- **File**: `icon.png`
- **Format**: PNG
- **Size**: 512x512 pixels
- **Usage**: Used for Linux AppImage and DEB packages

## How to Generate Icons

1. Start with a high-resolution PNG (at least 1024x1024)
2. Use tools like:
   - [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
   - [IconJar](https://iconjar.com/)
   - Online converters like [cloudconvert.com](https://cloudconvert.com/)
3. Place the generated files in this directory

## Note

The icons are currently **NOT included** in the repository. You need to add them before building the application for distribution.

The source logo can be found at `src/assets/logo.svg`.
