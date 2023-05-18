const { nanoid } = require('nanoid')

const _schema = [
  {
    name: 'SynchronizerState',
    rows: [
      ['pubkey', 'String', { unique: true }],
      {
        name: 'latestProcessedBlock',
        type: 'Int',
        default: 0,
      },
      {
        name: 'latestProcessedTransactionIndex',
        type: 'Int',
        default: 0,
      },
      {
        name: 'latestProcessedEventIndex',
        type: 'Int',
        default: 0,
      },
      {
        name: 'latestCompleteBlock',
        type: 'Int',
        default: 0,
      },
    ],
  },
  {
    name: 'Identity',
    rows: [
      ['pubkey', 'String', { unique: true }],
      ['s0', 'String'],
      ['shareCount', 'Int'],
    ],
  },
  {
    name: 'Token',
    rows: [
      ['pubkey', 'String'],
      ['hash', 'String'],
      ['index', 'Int'],
    ],
  },
]

/**
 * The schema of the database that is used in storing data
 */
module.exports = _schema.map((obj) => ({
  primaryKey: '_id',
  ...obj,
  rows: [
    ...obj.rows,
    {
      name: '_id',
      type: 'String',
      default: () => nanoid(),
    },
  ],
}))
