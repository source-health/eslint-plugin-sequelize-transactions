import { Rule } from "eslint";
import { Expression, Node as ESTreeNode, SpreadElement } from "estree";

type Node = ESTreeNode & {
  parent: ESTreeNode;
};

const FUNCTIONS_REQUIRING_TRANSACTION = new Set<string>([
  "create",
  "update",
  "destroy",
  "save",
  "bulkCreate",
]);
const ENTITY_SUFFIX = "Entity" as const;
const TRANSACTION_KEY = "transaction" as const;

function hasTransactionProperty(argument: Expression | SpreadElement): boolean {
  if (argument.type !== "ObjectExpression") {
    return false;
  }
  const transaction = argument.properties.find(
    (prop) =>
      prop.type === "Property" &&
      prop.key.type === "Identifier" &&
      prop.key.name === TRANSACTION_KEY
  );
  return !!transaction;
}

function hasTransactionArgument(node: Node): boolean {
  if (node.type !== "CallExpression") {
    return false;
  }
  const args = node.arguments;
  const argWithTransaction = args.find((arg) => hasTransactionProperty(arg));
  return !!argWithTransaction;
}

function parentIsEntity(node: Node): boolean {
  return (
    (node.parent.type === "MemberExpression" &&
      node.parent.object.type === "MemberExpression" &&
      node.parent.object.property.type === "Identifier" &&
      node.parent.object.property.name.endsWith(ENTITY_SUFFIX)) ||
    (node.parent.type === "MemberExpression" &&
      node.parent.object.type === "Identifier" &&
      node.parent.object.name.endsWith(ENTITY_SUFFIX))
  );
}

export function forceTransaction(context: Rule.RuleContext): Rule.RuleListener {
  return {
    Identifier(node) {
      if (
        FUNCTIONS_REQUIRING_TRANSACTION.has(node.name) &&
        parentIsEntity(node) &&
        !hasTransactionArgument(node.parent.parent)
      ) {
        context.report({
          node: node,
          message: `Call to sequelize's ${node.name}() must pass a transaction`,
        });
      }
    },
  };
}
