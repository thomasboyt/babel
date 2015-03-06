import * as react from "../../helpers/react";
import t from "../../../types";

export var optional = true;

var immutabilityVisitor = {
  enter(node, parent, scope, state) {
    if (t.isJSXIdentifier(node) && react.isCompatTag(node.name)) {
      return;
    }

    if (t.isJSXIdentifier(node) || t.isIdentifier(node)) {
      // direct references that we need to track to hoist this to the highest scope we can
      if (t.isReferenced(node, parent)) {
        state.identifiers.push(node.name);
        return;
      }
    }

    if (t.isJSXClosingElement(node)) {
      this.skip();
      return;
    }

    // ignore
    if (t.isIdentifier(node) || t.isJSXMemberExpression(node)) {
      return;
    }

    state.isImmutable = t.isImmutable(node);
    if (!state.isImmutable) this.stop();
  }
};

export function JSXElement(node, parent, scope, file) {
  // todo - check for `ref` attribute

  var state = {
    identifiers: [],
    isImmutable: true
  };

  this.traverse(immutabilityVisitor, state);
  this.skip();

  if (!state.isImmutable) return;

  var lastCompatibleScope = scope;
  var checkScope = scope;

  crawl: do {
    for (var i = 0; i < state.identifiers.length; i++) {
      if (!checkScope.hasBinding(state.identifiers[i])) {
        break crawl;
      }
    }
    lastCompatibleScope = checkScope;
  } while (checkScope = checkScope.parent);

  // same scope, nothing we can do about it
  if (lastCompatibleScope === scope) return;

  var uid = scope.generateUidIdentifier("ref");

  var scopeBlock = lastCompatibleScope.block;
  if (t.isFunction(scopeBlock)) {
    scopeBlock = scopeBlock.body;
  }

  if (t.isBlockStatement(scopeBlock) || t.isProgram(scopeBlock)) {
    scopeBlock.body.unshift(t.variableDeclaration("var", [
      t.variableDeclarator(uid, node)
    ]));
    return uid;
  }
}