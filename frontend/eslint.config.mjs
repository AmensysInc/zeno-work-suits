import next from 'eslint-config-next';

export default [
  ...next,
  { ignores: ['.next/**', 'legacy/**', 'legacy-config/**', 'next-env.d.ts'] },
];
