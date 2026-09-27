module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // new feature
        'fix', // bug fix
        'docs', // documentation only
        'style', // formatting, missing semi, etc. no code change
        'refactor', // code change that neither fixes a bug nor adds a feature
        'perf', // code change that improves performance
        'test', // adding tests
        'build', // changes to build system or dependencies
        'ci', // changes to CI config
        'chore', // other changes that don't modify src or test files
        'revert', // revert a previous commit
        'security', // security-related fix
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [2, 'always', 200],
    'footer-max-line-length': [2, 'always', 200],
  },
};
