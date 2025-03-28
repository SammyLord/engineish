const { Compilation } = require('webpack');

class LicenseExtractorPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('LicenseExtractorPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'LicenseExtractorPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        (assets) => {
          // Create Three.js license file
          compilation.emitAsset(
            'bundle.js.LICENSE.threejs.txt',
            new compiler.webpack.sources.RawSource(
              '/*! three.js - MIT License\n * Copyright © three.js authors\n */'
            )
          );

          // Create Engineish license file
          compilation.emitAsset(
            'bundle.js.LICENSE.engineish.txt',
            new compiler.webpack.sources.RawSource(
              '/*! engineish - SPL-R5 License\n * Copyright (c) Sneed Group\n */'
            )
          );
        }
      );
    });
  }
}

module.exports = LicenseExtractorPlugin;