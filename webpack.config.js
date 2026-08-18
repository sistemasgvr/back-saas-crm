const webpack = require('webpack');

/**
 * Bundle Nest en un solo dist/main.js.
 * Hostinger (lsnode) no resuelve bien requires relativos sin extensión
 * cuando tsconfig usa module: nodenext.
 */
module.exports = function (options) {
  const lazyImports = [
    '@nestjs/microservices',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    'class-transformer/storage',
  ];

  return {
    ...options,
    output: {
      ...options.output,
      filename: 'main.js',
    },
    plugins: [
      ...(options.plugins ?? []),
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (!lazyImports.includes(resource)) return false;
          try {
            require.resolve(resource);
            return false;
          } catch {
            return true;
          }
        },
      }),
    ],
  };
};
