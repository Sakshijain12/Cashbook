#!/usr/bin/env node
// apps/mobile/scripts/generate-assets.js
// Run: node scripts/generate-assets.js
// Creates placeholder PNG assets so Expo doesn't crash on missing files

const fs   = require('fs')
const path = require('path')

// Minimal 1x1 blue PNG (base64)
const BLUE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const assets = [
  'assets/icon.png',
  'assets/splash.png',
  'assets/adaptive-icon.png',
  'assets/favicon.png',
]

const dir = path.join(__dirname, '..')
for (const asset of assets) {
  const full = path.join(dir, asset)
  const folder = path.dirname(full)
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, BLUE_PNG)
    console.log('Created:', asset)
  } else {
    console.log('Exists: ', asset)
  }
}
console.log('Done. Replace these with real assets before publishing to the App Store.')
