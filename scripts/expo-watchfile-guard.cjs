const fs = require('fs');

const originalWatchFile = fs.watchFile.bind(fs);

// Ignore metadata-only Windows notifications while forwarding real config edits.
fs.watchFile = function watchFileWithContentCheck(filename, options, listener) {
  const hasOptions = typeof options !== 'function';
  const actualListener = hasOptions ? listener : options;

  if (typeof actualListener !== 'function') {
    return originalWatchFile(filename, options, listener);
  }

  const guardedListener = (current, previous) => {
    if (current.size === previous.size && current.mtimeMs === previous.mtimeMs) return;
    actualListener(current, previous);
  };

  return hasOptions
    ? originalWatchFile(filename, options, guardedListener)
    : originalWatchFile(filename, guardedListener);
};
