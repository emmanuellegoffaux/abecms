import fse from 'fs-extra'
import {Promise} from 'bluebird'
import path from 'path'
import {
  config,
  coreUtils,
  cmsData,
  abeExtend,
  cmsTemplates
} from '../../'
import * as sourceAttr from '../../cms/editor/handlebars/sourceAttr'

export function getTemplatesAndPartials(templatesPath, partialsPath) {
  let allFiles = []
  var p = new Promise((resolve) => {
    const extension = '.' + config.files.templates.extension
    return coreUtils.file.getFilesAsync(templatesPath, true, extension)
    .then(function(files){
      allFiles = allFiles.concat(files)
      return coreUtils.file.getFilesAsync(partialsPath, true, extension)
      .then(function(files){
        allFiles = allFiles.concat(files)
        return resolve(allFiles)
      })
    })
  })

  return p
}

export function addOrder(text) {
  var regAbe = /{{abe[\S\s].*?key=['|"]([\S\s].*?['|"| ]}})/g
  var matches = text.match(regAbe)
  
  if(typeof matches !== 'undefined' && matches !== null){
    var orderTab = []
    var arrayKey = []
    var max = 0
    var negIndex = -1

    // We create an array of keys/order and put -1 for keys without order
    Array.prototype.forEach.call(matches, (match) => {
      if(typeof match !== 'undefined' && match !== null) {
        var orderAttr = cmsData.regex.getAttr(match, 'order')
        var keyAttr = cmsData.regex.getAttr(match, 'key')
        if(typeof orderAttr === 'undefined' || orderAttr === null || orderAttr === '') {
          orderTab.push({key:keyAttr, order: negIndex})
          negIndex = negIndex - 1
        } else {
          max = Math.max(parseInt(orderAttr), max)
          orderTab.push({key:keyAttr, order: orderAttr})
        }
      }
    })

    // We sort the array
    orderTab.sort(coreUtils.sort.predicatBy('order', -1))

    // And increment the not ordered ones beginning with the last order found + 1
    Array.prototype.forEach.call(orderTab, (obj) => {
      if(obj.order < 0){
        max = max + 1
        arrayKey[obj.key] = max
      } else {
        arrayKey[obj.key] = parseInt(obj.order)
      }
    })

    // Then we put order attribute to each abe tag not ordered
    Array.prototype.forEach.call(matches, (match) => {
      if(typeof match !== 'undefined' && match !== null) {
        var orderAttr = cmsData.regex.getAttr(match, 'order')
        var keyAttr = cmsData.regex.getAttr(match, 'key')
        if(typeof orderAttr === 'undefined' || orderAttr === null || orderAttr === '') {
          var matchOrder = match.replace(/\}\}$/, ` order='${arrayKey[keyAttr]}'}}`)
          text = text.replace(match, matchOrder)
        }
      }
    })
  }

  return text
}

export function getAbeImport(text) {
  var partials = []
  let listReg = /({{abe.*type=[\'|\"]import.*}})/g
  var match
  while (match = listReg.exec(text)) {
    partials.push(match[0])
  }

  return partials
}

/**
 * it will include recursively each encountered type=import
 * and proceed to a foreach when the file={{some[]}} is an array of values
 * @param  {[type]} text [description]
 * @param  {[type]} json [description]
 * @return {[type]}      [description]
 */
export function includePartials(text, json) {
  var abeImports = cmsTemplates.template.getAbeImport(text)
  var duplicateImports = duplicateImports || []

  Array.prototype.forEach.call(abeImports, (abeImport) => {
    var obj = cmsData.attributes.getAll(abeImport, {})

    var file = obj.file
    var partial = ''
    file = path.join(config.root, config.themes.path, config.themes.name, config.themes.partials.path, file)
    file = cmsData.attributes.getValueFromAttribute(file, json)

    if(Object.prototype.toString.call(file) === '[object Array]' ) {
      Array.prototype.forEach.call(file, (f) => {
        if(coreUtils.file.exist(f)) {
          if(duplicateImports[f] != null){
            var tmpFile = fse.readFileSync(f, 'utf8')
            var regAbe = /{{abe .*key=[\'|\"](.*?)[\'|\"].*}}/g
            var matches = tmpFile.match(regAbe)
            var match
            while ((match = regAbe.exec(tmpFile)) !== null) {
              if (match[1] != null) {
                tmpFile = tmpFile.replace(match[0], match[0].replace(match[1], match[1] + '_' + duplicateImports[f]))
                tmpFile = tmpFile.replace(new RegExp(`\{\{${match[1]}`, 'g'), '{{' + match[1] + '_' + duplicateImports[f])
              }
            }
            duplicateImports[f] += 1
            partial += cmsTemplates.template.includePartials(tmpFile, json)
          } else{
            duplicateImports[f] = 1
            partial += cmsTemplates.template.includePartials(fse.readFileSync(f, 'utf8'), json)
          }
        }
      })
    } else {
      if(coreUtils.file.exist(file)) {
        if(duplicateImports[file] != null){
          var tmpFile = fse.readFileSync(file, 'utf8')
          var regAbe = /{{abe .*key=[\'|\"](.*?)[\'|\"].*}}/g
          var match
          while ((match = regAbe.exec(tmpFile)) !== null) {
            if (match[1] != null) {
              tmpFile = tmpFile.replace(match[0], match[0].replace(match[1], match[1] + '_' + duplicateImports[file]))
              tmpFile = tmpFile.replace(new RegExp(`\{\{${match[1]}`, 'g'), '{{' + match[1] + '_' + duplicateImports[file])
            }
          }

          duplicateImports[file] += 1
          partial = cmsTemplates.template.includePartials(tmpFile, json)
        } else {
          duplicateImports[file] = 1
          partial = cmsTemplates.template.includePartials(fse.readFileSync(file, 'utf8'), json)
        }
      }
    }
    text = text.replace(cmsData.regex.escapeTextToRegex(abeImport), partial)
  })

  return text
}

export function translate(text) {
  var importReg = /({{abe.*type=[\'|\"]translate.*}})/g

  var matches = text.match(importReg)
  
  if(typeof matches !== 'undefined' && matches !== null) {
    Array.prototype.forEach.call(matches, (match) => {
      var splitedMatches = match.split('{{abe ')

      Array.prototype.forEach.call(splitedMatches, (splitedMatch) => {
        var currentMatch = `{{abe ${splitedMatch}`
        if(/({{abe.*type=[\'|\"]translate.*}})/.test(currentMatch)) {
          var locale = cmsData.regex.getAttr(currentMatch, 'locale')
          var source = cmsData.regex.getAttr(currentMatch, 'source')

          if (locale.indexOf('{{') === -1) {
            locale = `'${locale}'`
          }else {
            locale = locale.replace(/\{\{(.*?)\}\}/, '$1')
          }

          if (source.indexOf('{{') === -1) {
            source = `'${source.replace(/'/g, '\\\'')}'`
          }else {
            source = source.replace(/\{\{(.*?)\}\}/, '$1')
          }

          // var replace = `{{{i18nAbe ${locale} ${source}}}}`
          var replace = currentMatch.replace('{{abe', '{{i18nAbe')
          replace = replace.replace(/locale=['|"].*?['|"]/, locale)
          replace = replace.replace(/source=['|"].*?['|"]/, source)
          replace = replace.replace(/{{i18nAbe.*?}}/, `{{{i18nAbe ${locale} ${source}}}}`)

          text = text.replace(cmsData.regex.escapeTextToRegex(currentMatch, 'g'), replace)
        }
      })
    })
  }

  return text
}

export function getTemplate (file, json = {}) {
  var text = ''

  // HOOKS beforeGetTemplate
  file = abeExtend.hooks.instance.trigger('beforeGetTemplate', file)

  file = file.replace(path.join(config.root, config.themes.path, config.themes.name, config.themes.templates.path), '')
  file = file.replace(config.root, '')
  if (file.indexOf('.') > -1) {
    file = file.replace(/\..+$/, '')
  }
  file = path.join(config.root, config.themes.path, config.themes.name, config.themes.templates.path, file + '.' + config.files.templates.extension)
  if(coreUtils.file.exist(file)) {
    text = fse.readFileSync(file, 'utf8')
    text = cmsTemplates.template.includePartials(text, json)
    text = cmsTemplates.template.translate(text)
    text = cmsTemplates.template.addOrder(text)
  } else {
    text = `[ ERROR ] template ${file} doesn't exist anymore`
  }

  // HOOKS afterGetTemplate
  text = abeExtend.hooks.instance.trigger('afterGetTemplate', text)

  return text
}

export function getVariablesInWhere(where) {
  var ar = []

  if(where.left.column.indexOf('{{') > -1) {
    ar.push(where.left.column.replace(/\{\{(.*?)\}\}/, '$1'))
  }
  else{
    ar.push(where.left.column)
  }

  if (where.right.value) {
    if (typeof where.right.value === 'string') {
      if(where.right.value && where.right.value.indexOf('{{') > -1) {
        ar.push(where.right.value.replace(/\{\{(.*?)\}\}/, '$1'))
      }
    }else {
      where.right.value.forEach(function (value) {
        if(value.column.indexOf('{{') > -1) {
          ar.push(value.column.replace(/\{\{(.*?)\}\}/, '$1'))
        }
      })
    }
  }

  if(where.right.column && where.right.column.indexOf('{{') > -1) {
    ar.push(where.right.column.replace(/\{\{(.*?)\}\}/, '$1'))
  }

  return ar
}

/**
 * Get columns and where.left ids of a select statement
 *
 * select title, image from ../ where template=""
 *
 * return [title, image, template]
 * 
 * @param  {Array} templatesList ["article.html", "other.html"]
 * @return {Promise}
 */
export function recurseWhereVariables (where) {
  var ar = []
  var arLeft
  var arRight
  switch(where.operator) {
  case 'AND':
    arLeft = cmsTemplates.template.recurseWhereVariables(where.left)
    arRight = cmsTemplates.template.recurseWhereVariables(where.right)
    return arLeft.concat(arRight)
    break
  case 'OR':
    arLeft = cmsTemplates.template.recurseWhereVariables(where.left)
    arRight = cmsTemplates.template.recurseWhereVariables(where.right)
    return arLeft.concat(arRight)
    break
  default:
    ar = getVariablesInWhere(where)
    break
  }

  return ar
}

export function getTemplatesTexts(templatesList, json) {
  var templates = []
  var p = new Promise((resolve) => {
    Array.prototype.forEach.call(templatesList, (file) => {
      var template = fse.readFileSync(file, 'utf8')
      template = cmsTemplates.template.includePartials(template, json)
      var name = file.replace(path.join(config.root, config.themes.path, config.themes.name, config.themes.templates.path, path.sep), '').replace(`.${config.files.templates.extension}`, '')
      templates.push({
        name: name,
        path: file,
        template: template
      })
    })
    resolve(templates)
  })

  return p
}

export function execRequestColumns(tpl) {
  var ar = []
  var matches = cmsData.regex.getTagAbeTypeRequest(tpl)
  Array.prototype.forEach.call(matches, (match) => {
    var obj = cmsData.attributes.getAll(match[0], {})
    var type = cmsData.sql.getSourceType(obj.sourceString)
    switch (type) {
    case 'request':
      var request = cmsData.sql.handleSqlRequest(obj.sourceString, {})
      if(typeof request.columns !== 'undefined' && request.columns !== null) {
        Array.prototype.forEach.call(request.columns, (column) => {
          ar.push(column)
        })
      }
      if(typeof request.where !== 'undefined' && request.where !== null) {
        ar = ar.concat(cmsTemplates.template.recurseWhereVariables(request.where))
      }
    }
  })

  return ar
}

export function getAbeRequestWhereKeysFromTemplates(templatesList) {
  var whereKeys = []
  var p = new Promise((resolve) => {
    Array.prototype.forEach.call(templatesList, (file) => {
      whereKeys = whereKeys.concat(cmsTemplates.template.execRequestColumns(file.template))
    })
    whereKeys = whereKeys.filter(function (item, pos) {
      item = item.split('.')[0].split('[')[0]
      return whereKeys.indexOf(item) == pos
    })
    resolve(whereKeys)
  })

  return p
}

export function setAbeSlugDefaultValueIfDoesntExist(templateText) {
  var matches = cmsData.regex.getTagAbeWithType(templateText, 'slug')
  if(matches == null || matches[0] == null) {
    templateText = `{{abe type="slug" source="{{name}}"}}\n${templateText}`
  }

  return templateText
}

export function getAbeSlugFromTemplates(templatesList) {
  var slugs = {}
  Array.prototype.forEach.call(templatesList, (file) => {
    var templateText = cmsTemplates.template.setAbeSlugDefaultValueIfDoesntExist(file.template)
    var matchesSlug = cmsData.regex.getTagAbeWithType(templateText, 'slug')
    var obj = cmsData.attributes.getAll(matchesSlug[0], {})
    slugs[file.name] = obj.sourceString
  })
  return slugs
}

export function setAbePrecontribDefaultValueIfDoesntExist(templateText) {
  var matches = cmsData.regex.getTagAbeWithTab(templateText, 'slug')
  if(matches == null || matches[0] == null) {
    templateText = `{{abe type='text' key='name' desc='Name' required="true" tab="slug" visible="false"}}\n${templateText}`
  }

  return templateText
}

export function getAbePrecontribFromTemplates(templatesList) {
  var fields = []
  var precontributionTemplate = []

  // loop over template file
  Array.prototype.forEach.call(templatesList, (file) => {
    var slugMatch = cmsData.regex.getTagAbeWithType(file.template, 'slug')
    var templateText = file.template
    if(slugMatch == null || slugMatch[0] == null) {
      templateText = cmsTemplates.template.setAbePrecontribDefaultValueIfDoesntExist(file.template)
    }

    templateText = templateText.replace(/(?!.*?tab=['|"]slug)(\{\{abe.+.*)/g, '')
    templateText = templateText.replace(/(\{\{abe.+)(\}\})/g, `$1 precontribTemplate="${file.name}"$2`)
    precontributionTemplate.push(templateText)
  })

  return {
    // fields: fields,
    template: precontributionTemplate
  }
}

export function getStructureAndTemplates() {
  const pathStructure = path.join(config.root, config.structure.url)
  const pathTemplates = path.join(config.root, config.themes.path, config.themes.name, config.themes.templates.path)
  const extension = '.' + config.files.templates.extension
  let result = {'structure': [], 'templates': []}

  result.structure = coreUtils.file.getFoldersSync(pathStructure, true)
  let templatePaths = coreUtils.file.getFilesSync(pathTemplates, true, extension)
  Array.prototype.forEach.call(templatePaths, (templatePath) => {
    let additionalPath = path.dirname(templatePath).replace(pathTemplates,'')
    if(additionalPath !== '') additionalPath = additionalPath.substring(1)
    let name = path.join(additionalPath,path.basename(templatePath,extension))
    let template = {'path':templatePath, 'name':name}
    result.templates.push(template)
  })

  return result
}