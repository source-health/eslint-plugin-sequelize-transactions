import { forceTransaction } from './force-transaction'

module.exports = {
  rules: {
    'force-transaction': {
      create: forceTransaction,
    },
  },
}
