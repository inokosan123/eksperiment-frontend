const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

// Metro 0.83 ships a recursive NativeWatcher that is implemented with
// ReadDirectoryChangesW, but its feature gate is still limited to macOS.
// The fallback watcher opens one fs.watch handle per directory and can starve
// Metro on this Windows workspace, so opt this local dev process into the
// native recursive backend. This affects the bundler only, never app runtime.
if (process.platform === 'win32') {
  const fileMapRoot = path.dirname(require.resolve('metro-file-map/package.json'));
  const NativeWatcher = require(
    path.join(fileMapRoot, 'src', 'watchers', 'NativeWatcher.js'),
  ).default;
  const handleNativeEvent = NativeWatcher.prototype._handleEvent;

  NativeWatcher.isSupported = () => true;
  NativeWatcher.prototype._handleEvent = function handleWindowsNativeEvent(
    relativePath,
  ) {
    // Node documents that the filename can be null, and Windows may briefly
    // lock generated files while an editor replaces them. Neither condition
    // should bring down the entire dev server.
    if (relativePath == null) return Promise.resolve();

    const normalizedPath = Buffer.isBuffer(relativePath)
      ? relativePath.toString()
      : relativePath;

    return handleNativeEvent.call(this, normalizedPath).catch(error => {
      if (error?.code === 'EPERM') return;
      throw error;
    });
  };
}

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('db', 'sqlite', 'wasm', 'lottie');

// Metro's Windows fallback watcher opens one watcher per directory. Keep
// generated workspace data out of its file map so Fast Refresh is not starved
// by npm caches, exports, browser artifacts, or local diagnostic runtimes.
const escapeForRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const workspaceRootPattern = escapeForRegExp(path.resolve(__dirname));
const workspacePath = source =>
  new RegExp(`^${workspaceRootPattern}[\\\\/]${source}(?:[\\\\/]|$)`);

const generatedWorkspacePaths = [
  workspacePath('\\.git'),
  workspacePath('\\.npm-cache'),
  workspacePath('\\.tools'),
  workspacePath('dist'),
  workspacePath('\\.focus-export-check'),
  workspacePath('\\.focus-ios-export-check'),
  workspacePath('\\.playwright-mcp'),
  workspacePath('\\.playwright-runtime'),
  workspacePath('node_modules[\\\\/]\\.cache'),
  new RegExp(
    `^${workspaceRootPattern}[\\\\/](?:expo|metro)[^\\\\/]*\\.log$`,
  ),
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]),
  ...generatedWorkspacePaths,
].filter(Boolean);

config.server.enhanceMiddleware = middleware => (request, response, next) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(request, response, next);
};

module.exports = config;
