const { poseidon1 } = require('poseidon-lite/poseidon1')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { F, modinv, safemod } = require('./math')
const randomf = require('randomf')
const RegisterProof = require('./RegisterProof')
const AddTokenProof = require('./AddTokenProof')
const Synchronizer = require('./Synchronizer')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree')

module.exports = class Identity {
  // if we don't initialize with a pubkey
  // let's precalculate an s0/token to
  // precalculate a pubkey
  constructor(config) {
    const { db, address, token, pubkey, prover } = config
    if (!prover) {
      throw new Error('Must supply a prover')
    }
    this.prover = prover
    if (token && !pubkey) {
      throw new Error('Must supply pubkey with token')
    }
    if (token) {
      // token and pubkey
      this.pubkey = BigInt(pubkey)
      this.token = BigInt(token)
    } else if (!pubkey) {
      // no pubkey, precal proof values
      this.token = randomf(F)
      this.pubkey = poseidon1([this.token]) + 1n
    }

    this.sync = new Synchronizer({
      ...config,
      token: this.token,
      pubkey: this.pubkey,
    })
  }

  async loadSecret() {
    const token = await this.sync._db.findOne('Token', {
      where: {
        pubkey: this.pubkey.toString(),
        hash: poseidon1([this.token]).toString(),
      },
    })
    const identity = await this.sync._db.findOne('Identity', {
      where: {
        pubkey: this.pubkey.toString(),
      },
    })
    const n = BigInt(token.index)
    const s0 = BigInt(identity.s0)
    const secret = safemod((n * s0 - this.token) * modinv(n - 1n))
    return secret
  }

  async registerProof() {
    const s0 = randomf(F)
    const { backupTreeDepth } = this.sync?.settings
    const backupTree = new IncrementalMerkleTree(poseidon2, backupTreeDepth, 0n)
    const backupCodes = []
    for (let x = 0; x < 2 ** backupTreeDepth; x++) {
      const code = randomf(F)
      backupCodes.push(code)
      backupTree.insert(code)
    }
    // TODO: store the backup tree in DB
    const { publicSignals, proof } = await this.prover.genProofAndPublicSignals(
      'register',
      {
        s0,
        session_token: this.token,
        backup_tree_root: backupTree.root,
      }
    )
    const regProof = new RegisterProof(publicSignals, proof, this.prover)
    if (regProof.pubkey !== this.pubkey) {
      throw new Error('pubkey mismatch')
    }
    return regProof
  }

  async addTokenProof(config) {
    const secret = config?.secret ?? (await this.loadSecret())
    const token = await this.sync._db.findOne('Token', {
      where: {
        hash: poseidon1([this.token]).toString(),
      },
    })
    const identity = await this.sync._db.findOne('Identity', {
      where: {
        pubkey: this.pubkey.toString(),
      },
    })
    const s0 = BigInt(identity.s0)
    const shareCount = BigInt(identity.shareCount)
    const newToken = safemod(secret + (s0 - secret) * shareCount)
    const sessionTree = await this.sync.buildSessionTree()
    sessionTree.insert(0n)
    const merkleProof = sessionTree.createProof(sessionTree.leaves.length - 1)
    const { publicSignals, proof } = await this.prover.genProofAndPublicSignals(
      'addToken',
      {
        s0,
        secret,
        share_count: shareCount,
        session_token: newToken,
        pubkey: this.pubkey,
        session_tree_indices: merkleProof.pathIndices,
        session_tree_siblings: merkleProof.siblings,
        old_session_tree_root: sessionTree.root,
      }
    )
    return new AddTokenProof(publicSignals, proof, this.prover)
  }
}
