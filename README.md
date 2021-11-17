# eslint-plugin-sequelize-transactions

This is an ESLint plugin that can help catch missing transactions being passed to any of the 'write' methods in Sequelize. The rationale is that it is easy to forget to pass a transaction into these methods which can cause data to be written outside the transaction with unfortunate consequences.

# Approach

This plugin looks for calls to any of the mutatative methods in sequelize: `create()`, `update()`, `destroy()`, `save()`, and `bulkCreate()`. Unless the call is ignored (see config section), one of the arguments to the method must be an object containing the key `'transaction'`.

# Config

Add to your development dependencies, e.g.

```
yarn add --dev eslint-plugin-sequelize-transactions
```

Configure the rule in .eslintrc:

```json
{
  "rules": [
    "sequelize-transactions/force-transaction": ["error", {
      "ignorePatterns": [".*Service", "HttpClient", "this"]
    }]
  ]
}
```

The only (optional) option is 'ignorePatterns' - you can provide an array of regex strings that, if the 'parent' of the method call (i.e. in dotted member access notation, the segment to the left of the sequelize method) matches, that call will be ignored.

e.g. if you have any of these patterns in your codebase, you may wish to have this rule ignore them

```
   fooService.create() // IgnorePatterns should include 'fooService' or '.*Service'
   HttpClient.create() // Some library may use 'create()' in a way that we can ignore
   this.save()         // Common to name a method save() in a non-Sequelize class.
```
