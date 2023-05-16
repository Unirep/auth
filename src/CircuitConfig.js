const defaultConfig = {
  SESSION_TREE_DEPTH: 5,
}

module.exports = class CircuitConfig {
  constructor(config) {
    this.SESSION_TREE_DEPTH =
      config?.SESSION_TREE_DEPTH ?? defaultConfig.SESSION_TREE_DEPTH
  }
}
