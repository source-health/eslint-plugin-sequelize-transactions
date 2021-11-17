import { Rule } from 'eslint'
// eslint-disable-next-line import/no-unresolved
import { CallExpression, Node as ESTreeNode, Expression, SpreadElement } from 'estree'

const FUNCTIONS_REQUIRING_TRANSACTION = new Set<string>([
  'create',
  'update',
  'destroy',
  'save',
  'bulkCreate,',
])
const TRANSACTION_KEY = 'transaction' as const

type Node = ESTreeNode & {
  parent: Node | null
}

/**
 * Helper function - is the given function call argument an object and if so, does it contain 'transaction' as a key?
 */
function hasTransactionProperty(argument: Expression | SpreadElement): boolean {
  if (argument.type !== 'ObjectExpression') {
    return false
  }
  const transaction = argument.properties.find(
    (prop) =>
      prop.type === 'Property' &&
      prop.key.type === 'Identifier' &&
      prop.key.name === TRANSACTION_KEY,
  )
  return !!transaction
}

/**
 * Helper function: does the given CallExpression (a function call in AST representation) have any arguments that are
 * objects with 'transaction' as a key?
 */
function hasTransactionArgument(node: CallExpression): boolean {
  const args = node.arguments
  const argWithTransaction = args.find((arg) => hasTransactionProperty(arg))
  return !!argWithTransaction
}

/**
 * Helper method: look up the parent and return its name if it is part of a member expression. The idea is to get the
 * name of the preceeding segment of the dotted-access member expression. Examples:
 *    this.save() => this
 *    memberEntity.update() => memberEntity
 *    this.memberEntity.create() => memberEntity
 */
function getParentName(node: Node): string | undefined {
  if (!node.parent) {
    return undefined
  }
  if (
    node.parent.type === 'MemberExpression' &&
    node.parent.object.type === 'MemberExpression' &&
    node.parent.object.property.type === 'Identifier'
  ) {
    return node.parent.object.property.name
  }

  if (node.parent.type === 'MemberExpression' && node.parent.object.type === 'ThisExpression') {
    return 'this'
  }

  if (node.parent.type === 'MemberExpression' && node.parent.object.type === 'Identifier') {
    return node.parent.object.name
  }
  return undefined
}

/**
 * Helper function: should the 'parent' in the member expression be ignored, according to the config for the rule?
 */
function parentIsIgnored(node: Node, ignorePatterns: RegExp[]): boolean {
  if (ignorePatterns.length === 0) {
    return false
  }
  const parentName = getParentName(node)
  if (parentName === undefined) {
    return false
  }
  for (const ignorePattern of ignorePatterns) {
    if (parentName.match(ignorePattern)) {
      return true
    }
  }
  return false
}

/** Helper: recursively look upwards in the AST hierarchy to see if we are part of a call expression.
 * If we are, then return the call expression, if not, after a few levels, break out and return undefined.
 * We need the parent call expression to inspect its arguments.
 */
function getCallExpression(node: Node | null, depth: number = 0): CallExpression | undefined {
  if (!node) {
    return undefined
  }
  if (node.type === 'CallExpression') {
    return node
  }
  if (depth > 4) {
    return undefined
  }
  if ('parent' in node) {
    return getCallExpression(node.parent, depth + 1)
  }
  return undefined
}

/**
 * Options - the shape of the options that can be defined in eslintrc
 */
interface Options {
  ignorePatterns?: string[]
}

/**
 * parse the options from eslintrc, which are annoyingly wrapped in an array, but we want the first element which would
 * be an Options object if present.
 */
function parseOptions(options: unknown[]): Options {
  if (options.length === 0) {
    return {}
  }
  return options[0] as Options
}

/**
 * The rule factory itself.
 */
export function forceTransaction(context: Rule.RuleContext): Rule.RuleListener {
  const options = parseOptions(context.options)
  const ignorePatterns = (options.ignorePatterns ?? []).map(
    (pattern: string) => new RegExp(pattern),
  )

  return {
    Identifier(node) {
      // Quick return if we aren't looking at a potential Sequelize function call
      if (!FUNCTIONS_REQUIRING_TRANSACTION.has(node.name)) {
        return
      }
      // Quick return if we should ignore this based on the name of the parent in the member expression.
      if (parentIsIgnored(node, ignorePatterns)) {
        return
      }

      // Grab the call expression, if this is part of a call expression
      const callExpression = getCallExpression(node)
      if (callExpression === undefined) {
        return
      }
      // If the arguments to the call don't include `{ transaction: <anything>}`, then it's a linter problem.
      if (!hasTransactionArgument(callExpression)) {
        context.report({
          node: node,
          message: `Call to sequelize's ${node.name}() must pass a transaction`,
        })
      }
    },
  }
}
