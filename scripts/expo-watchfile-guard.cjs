const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const originalWatchFile = fs.watchFile.bind(fs);
const guardedConfigNames = new Set(['babel.config.js', 'metro.config.js']);

function shouldGuard(filename) {
  const value = Buffer.isBuffer(filename) ? filename.toString() : String(filename);
  return guardedConfigNames.has(path.basename(value).toLowerCase());
}

function contentSignature(filename) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  } catch {
    return null;
  }
}

// Expo's FileNotifier logs every fs.watchFile callback. Windows can emit those
// callbacks when only file metadata changes, so compare the actual config
// contents and forward each real edit exactly once.
fs.watchFile = function watchFileWithContentCheck(filename, options, listener) {
  const hasOptions = typeof options !== 'function';
  const actualListener = hasOptions ? listener : options;

  if (typeof actualListener !== 'function' || !shouldGuard(filename)) {
    return originalWatchFile(filename, options, listener);
  }

  let previousSignature = contentSignature(filename);
  const guardedListener = (current, previous) => {
    const nextSignature = contentSignature(filename);
    if (nextSignature !== null && nextSignature === previousSignature) return;
    if (nextSignature !== null) previousSignature = nextSignature;
    actualListener(current, previous);
  };

  return hasOptions
    ? originalWatchFile(filename, options, guardedListener)
    : originalWatchFile(filename, guardedListener);
};

process.env.ANASTA_EXPO_WATCH_GUARD = '1';
