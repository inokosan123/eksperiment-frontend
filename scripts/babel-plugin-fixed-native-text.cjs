'use strict';

/**
 * React 19 no longer applies `defaultProps` on function components. React
 * Native's Text/TextInput are function-like host wrappers, so mutating their
 * defaults is not a dependable application policy.
 *
 * This Babel pass makes the release policy explicit at every app-owned native
 * text call site without a risky, two-thousand-element source rewrite.
 * Every app-owned native Text/TextInput is fixed at its authored size for the
 * release; direct props and spread props cannot opt a call site back in.
 *
 * It also covers Animated.Text from React Native and Reanimated. The transform
 * never runs inside node_modules.
 */
module.exports = function fixedNativeTextPlugin({ types: t }) {
  const removeAttribute = (path, name) => {
    path.node.attributes = path.node.attributes.filter(attribute => !(
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name })
    ));
  };

  const numberAttribute = (name, value) => t.jsxAttribute(
    t.jsxIdentifier(name),
    t.jsxExpressionContainer(t.numericLiteral(value)),
  );

  const booleanAttribute = (name, value) => t.jsxAttribute(
    t.jsxIdentifier(name),
    t.jsxExpressionContainer(t.booleanLiteral(value)),
  );

  return {
    name: 'anasta-fixed-native-text-policy',
    pre(file) {
      const filename = file.opts.filename?.replace(/\\/g, '/') ?? '';
      this.skipFile = filename.includes('/node_modules/');
      this.nativeTextNames = new Set();
      this.nativeTextInputNames = new Set();
      this.nativeAnimatedNames = new Set();
      this.reanimatedNamespaceNames = new Set();
    },
    visitor: {
      ImportDeclaration(path) {
        if (this.skipFile) return;
        const source = path.node.source.value;

        if (source === 'react-native') {
          path.node.specifiers.forEach(specifier => {
            if (t.isImportSpecifier(specifier)) {
              const imported = t.isIdentifier(specifier.imported)
                ? specifier.imported.name
                : specifier.imported.value;
              if (imported === 'Text') this.nativeTextNames.add(specifier.local.name);
              if (imported === 'TextInput') this.nativeTextInputNames.add(specifier.local.name);
              if (imported === 'Animated') this.nativeAnimatedNames.add(specifier.local.name);
            }
            if (t.isImportNamespaceSpecifier(specifier)) {
              this.nativeAnimatedNames.add(specifier.local.name);
            }
          });
        }

        if (source === 'react-native-reanimated') {
          path.node.specifiers.forEach(specifier => {
            if (t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier)) {
              this.reanimatedNamespaceNames.add(specifier.local.name);
            }
          });
        }
      },

      JSXOpeningElement(path) {
        if (this.skipFile) return;
        const name = path.node.name;
        let isNativeText = false;

        if (t.isJSXIdentifier(name)) {
          isNativeText = this.nativeTextNames.has(name.name)
            || this.nativeTextInputNames.has(name.name);
        } else if (
          t.isJSXMemberExpression(name)
          && t.isJSXIdentifier(name.object)
          && t.isJSXIdentifier(name.property, { name: 'Text' })
        ) {
          isNativeText = this.nativeAnimatedNames.has(name.object.name)
            || this.reanimatedNamespaceNames.has(name.object.name);
        }

        if (!isNativeText) return;

        // Remove any local opt-in and append the fixed values after all spread
        // props so a caller cannot accidentally re-enable Dynamic Type.
        removeAttribute(path, 'allowFontScaling');
        removeAttribute(path, 'maxFontSizeMultiplier');
        path.node.attributes.push(booleanAttribute('allowFontScaling', false));
        path.node.attributes.push(numberAttribute('maxFontSizeMultiplier', 1));
      },
    },
  };
};
