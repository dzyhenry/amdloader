import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';

export default {
  input: './src/index.js',
  output: {
    file: './test/amdjs-tests/impl/amdloader/amdloader.js',
    format: 'iife',
    name: 'amdloader',
  },
  globals: {
    global: 'this',
  },
  plugins: [
    resolve(),
    babel({ exclude: 'node_modules/*' }),
  ],
  watch: {
    include: 'src/**',
  },
  sourcemap: true,
};
