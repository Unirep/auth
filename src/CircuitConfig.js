const defaultConfig = {
  SESSION_TREE_DEPTH: 5,
  BACKUP_TREE_DEPTH: 8,
  IDENTITY_TREE_DEPTH: 20,
}

module.exports = class CircuitConfig {
  constructor(config) {
    this.SESSION_TREE_DEPTH =
      config?.SESSION_TREE_DEPTH ?? defaultConfig.SESSION_TREE_DEPTH
    this.BACKUP_TREE_DEPTH =
      config?.BACKUP_TREE_DEPTH ?? defaultConfig.BACKUP_TREE_DEPTH
    this.IDENTITY_TREE_DEPTH =
      config?.IDENTITY_TREE_DEPTH ?? defaultConfig.IDENTITY_TREE_DEPTH
  }
}
