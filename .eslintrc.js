module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  extends: ['standard'],
  globals: {
    document: true,
    navigator: true,
    window: true
  }
}
