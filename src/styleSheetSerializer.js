const css = require('css')
const { getCSS, getHashes } = require('./utils')

const KEY = '__jest-styled-components__'

const getNodes = (node, nodes = [], parentName) => {
  const styledName = (node.node && node.node.type.displayName) || parentName

  if (typeof node === 'object') {
    nodes.push(node)
    node.styledName = styledName
  }

  if (node.children) {
    node.children.forEach(child => getNodes(child, nodes, styledName))
  }

  return nodes
}

const markNodes = nodes => nodes.forEach(node => (node[KEY] = true))

const getClassNames = nodes => {
  const classNameMap = {}
  const classNamesResult = nodes.reduce((classNames, node) => {
    const classNameProp =
      node.props && (node.props.class || node.props.className)

    if (classNameProp) {
      classNameProp
        .trim()
        .split(/\s+/)
        .forEach((className, index) => {
          classNames.add(className)
          if (node.styledName) {
            classNameMap[className] = {
              styled_name: node.styledName,
              index,
            }
          }
        })
    }

    return classNames
  }, new Set())
  return {
    classNames: classNamesResult,
    classNameMap,
  }
}

const filterClassNames = (classNames, hashes) =>
  classNames.filter(className => hashes.includes(className))

const includesClassNames = (classNames, selectors) =>
  classNames.some(className =>
    selectors.some(selector => selector.includes(className))
  )

const filterRules = classNames => rule =>
  rule.type === 'rule' &&
  includesClassNames(classNames, rule.selectors) &&
  rule.declarations.length

const getAtRules = (ast, filter) =>
  ast.stylesheet.rules
    .filter(rule => rule.type === 'media' || rule.type === 'supports')
    .reduce((acc, atRule) => {
      atRule.rules = atRule.rules.filter(filter)

      if (atRule.rules.length) {
        return acc.concat(atRule)
      }

      return acc
    }, [])

const getStyle = classNames => {
  const ast = getCSS()
  const filter = filterRules(classNames)
  const rules = ast.stylesheet.rules.filter(filter)
  const atRules = getAtRules(ast, filter)

  ast.stylesheet.rules = rules.concat(atRules)

  return css.stringify(ast)
}

const getNameClassname = (className, classNameMap, classCounter) => {
  let name = 'c'
  if (classNameMap[className]) {
    name = `${classNameMap[className].styled_name}-${
      classNameMap[className].index
    }`
  }
  if (!classCounter[name] && classCounter[name] !== 0) {
    classCounter[name] = 0
  } else {
    classCounter[name]++
    name += `-${classCounter[name]}`
  }

  return name
}

const replaceClassNames = (result, classNames, style, classNameMap) => {
  const classCounter = {}
  return classNames
    .filter(className => style.includes(className))
    .reduce(
      (acc, className) =>
        acc.replace(
          new RegExp(className, 'g'),
          getNameClassname(className, classNameMap, classCounter)
        ),
      result
    )
}

const replaceHashes = (result, hashes) =>
  hashes.reduce(
    (acc, className) =>
      acc.replace(
        new RegExp(`((class|className)="[^"]*?)${className}\\s?([^"]*")`, 'g'),
        '$1$3'
      ),
    result
  )

const styleSheetSerializer = {
  test(val) {
    return val && !val[KEY] && val.$$typeof === Symbol.for('react.test.json')
  },

  print(val, print) {
    const nodes = getNodes(val)
    markNodes(nodes)

    const hashes = getHashes()
    const resultClassName = getClassNames(nodes)
    let { classNames } = resultClassName
    const { classNameMap } = resultClassName

    classNames = [...classNames]
    classNames = filterClassNames(classNames, hashes)

    const style = getStyle(classNames)
    const code = print(val)

    let result = `${style}${style ? '\n\n' : ''}${code}`
    result = replaceClassNames(result, classNames, style, classNameMap)
    result = replaceHashes(result, hashes)

    return result
  },
}

module.exports = styleSheetSerializer
