const { poseidon1 } = require('poseidon-lite/poseidon1')
const { poseidon2 } = require('poseidon-lite/poseidon2')
const { F, modinv, safemod, calcsecret } = require('./math')
const randomf = require('randomf')
const RegisterProof = require('./RegisterProof')
const AddTokenProof = require('./AddTokenProof')
const RemoveTokenProof = require('./RemoveTokenProof')
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
    if (token && (!token.x || !token.y)) {
      throw new Error('Token does not have x or y')
    }
    if (token && pubkey) {
      // token and pubkey
      this.pubkey = BigInt(pubkey)
      this.token = {
        x: BigInt(token.x),
        y: BigInt(token.y),
      }
    } else if (!token && !pubkey) {
      // no pubkey or token, precal proof values
      this.token = {
        y: randomf(F),
        x: randomf(F),
      }
      this.pubkey = poseidon1([this.token.y]) + 1n
    } else if (pubkey) {
      this.pubkey = BigInt(pubkey)
    } else {
      throw new Error('Must supply pubkey with token')
    }

    this.sync = new Synchronizer({
      ...config,
      pubkey: this.pubkey,
    })
  }

  async loadSecret() {
    if (!this.token) {
      throw new Error('No token set for identity')
    }
    const token = await this.sync._db.findOne('Token', {
      where: {
        pubkey: this.pubkey.toString(),
        hash: poseidon1([this.token.y]).toString(),
      },
    })
    if (!token) {
      throw new Error('Unable to find token in db')
    }
    const identity = await this.sync._db.findOne('Identity', {
      where: {
        pubkey: this.pubkey.toString(),
      },
    })
    if (!identity) {
      throw new Error('Unable to find identity in db')
    }
    const n = BigInt(token.index)
    const s0 = BigInt(identity.s0)
    const secret = calcsecret(s0, this.token.y, this.token.x)
    return secret
  }

  async registerProof() {
    const s0 = randomf(F)
    await this.sync?.setup()
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
        session_token: this.token.y,
        session_token_x: this.token.x,
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
    const secret = BigInt(config?.secret ?? (await this.loadSecret()))
    const identity = await this.sync._db.findOne('Identity', {
      where: {
        pubkey: this.pubkey.toString(),
      },
    })
    if (!identity) {
      throw new Error('Unable to find identity, are you synced?')
    }
    const s0 = BigInt(identity.s0)
    const newTokenX = randomf(F)
    const a = safemod(s0 - secret)
    const newToken = safemod(newTokenX * a + secret)
    const sessionTree = await this.sync.buildSessionTree()
    sessionTree.insert(0n)
    const merkleProof = sessionTree.createProof(sessionTree.leaves.length - 1)
    const { publicSignals, proof } = await this.prover.genProofAndPublicSignals(
      'addToken',
      {
        s0,
        session_token: newToken,
        session_token_x: newTokenX,
        pubkey: this.pubkey,
        session_tree_indices: merkleProof.pathIndices,
        session_tree_siblings: merkleProof.siblings,
        old_session_tree_root: sessionTree.root,
      }
    )
    if (!this.token) {
      // TODO: refactor this, external applications might want more control
      this.token = {
        x: newTokenX,
        y: newToken,
      }
    }
    const addTokenProof = new AddTokenProof(publicSignals, proof, this.prover)
    addTokenProof.token = {
      x: newTokenX,
      y: newToken,
    }
    return addTokenProof
  }

  async removeTokenProof(config = {}) {
    const { tokenHash } = config
    if (!tokenHash) {
      throw new Error('No tokenHash supplied')
    }
    const secret = await this.loadSecret()
    const identity = await this.sync._db.findOne('Identity', {
      where: {
        pubkey: this.pubkey.toString(),
      },
    })
    const s0 = BigInt(identity.s0)
    const sessionTree = await this.sync.buildSessionTree()
    const leaf = poseidon1([this.token.y])
    const leafIndex = sessionTree.leaves.findIndex((v) => BigInt(v) === leaf)
    const authMerkleProof = sessionTree.createProof(leafIndex)
    const removeLeafIndex = sessionTree.leaves.findIndex(
      (v) => BigInt(v) === BigInt(tokenHash)
    )
    const removeMerkleProof = sessionTree.createProof(removeLeafIndex)
    const { publicSignals, proof } = await this.prover.genProofAndPublicSignals(
      'removeToken',
      {
        s0,
        session_token: this.token.y,
        session_token_x: this.token.x,
        pubkey: this.pubkey,
        session_tree_indices: authMerkleProof.pathIndices,
        session_tree_siblings: authMerkleProof.siblings,
        old_session_tree_root: sessionTree.root,
        session_tree_change_indices: removeMerkleProof.pathIndices,
        session_tree_change_siblings: removeMerkleProof.siblings,
        session_leaf: tokenHash,
      }
    )
    return new RemoveTokenProof(publicSignals, proof, this.prover)
  }
}
