import next from 'eslint-config-next';

export default [
  ...next,
  { ignores: ['.next/**', 'next-env.d.ts'] },
  {
    // React Compiler advisories: client-only reads after mount (localStorage, URL hash) and
    // time-relative filters are intentional here, and react-hook-form opts out of compilation.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/incompatible-library': 'off',
    },
  },
];
