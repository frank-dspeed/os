module.exports = {
  extends: 'stylelint-config-standard',
  plugins: [
    'stylelint-scss'
  ],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        'ignoreAtRules': [
          'extend',
          'mixin',
          'include',
          'each'
        ]
      }
    ]
  }
};
