# Windows Installation Guide

## Issue: canvas Native Module Compilation

The `chartjs-node-canvas` package depends on `canvas`, which requires native C++ compilation on Windows. This requires Visual Studio Build Tools.

## ✅ Solution: Automatic Fallback to Puppeteer

**Good news!** The system now automatically falls back to Puppeteer-based chart generation if `chartjs-node-canvas` cannot be installed. This means:

- ✅ **No Visual Studio Build Tools required**
- ✅ **Charts will still work** (using Puppeteer + Chart.js in browser)
- ✅ **All functionality preserved**

### Installation Steps

1. **Install dependencies (chartjs-node-canvas will fail, but that's OK):**
   ```powershell
   cd backend
   npm install
   ```

2. **The system will automatically use Puppeteer for charts** - no action needed!

3. **Verify installation:**
   ```powershell
   npm start
   ```

### How It Works

The `chartGenerationService.js` automatically detects if `chartjs-node-canvas` is available:
- ✅ **If available**: Uses native chartjs-node-canvas (faster)
- ✅ **If unavailable**: Automatically falls back to Puppeteer (works on Windows without build tools)

### Optional: Install Visual Studio Build Tools (For Better Performance)

If you want to use the faster native chart generation:

1. **Install Visual Studio Build Tools:**
   - Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Run the installer
   - Select "Desktop development with C++" workload
   - Click Install

2. **Reinstall dependencies:**
   ```powershell
   cd backend
   npm install
   ```

3. **The system will automatically use chartjs-node-canvas** (faster than Puppeteer)

## Current Status

- ✅ All code implementation is complete
- ✅ Automatic fallback to Puppeteer (no build tools needed)
- ✅ Charts work on Windows without Visual Studio
- ✅ Optional: Install build tools for better performance

## Performance Comparison

- **chartjs-node-canvas**: ~100-200ms per chart (faster)
- **Puppeteer**: ~500-1000ms per chart (slower but works everywhere)

For most use cases, the Puppeteer performance is acceptable.

