var chai = require('chai');
var sinonChai = require('sinon-chai')
var expect = chai.expect
chai.use(sinonChai)
var sinon = require('sinon');
var path = require('path');
var fse = require('fs-extra');

var config = require('../src/cli').config
config.set({root: path.join(process.cwd(), 'test','fixtures')})

var abeExtend = require('../src/cli').abeExtend
var cmsData = require('../src/cli').cmsData
var Manager = require('../src/cli').Manager
var coreUtils = require('../src/cli').coreUtils
var cmsOperations = require('../src/cli').cmsOperations
var cmsTemplates = require('../src/cli').cmsTemplates
var Manager = require('../src/cli').Manager;
var Page = require('../src/cli').Page;

describe('cmsOperations', function() {
  before( function(done) {
    Manager.instance.init()
      .then(function () {
        Manager.instance._whereKeys = ['title', 'priority', 'abe_meta', 'articles']
        Manager.instance.updateList()

        this.fixture = {
          htmlArticle: fse.readFileSync(path.join(process.cwd(), 'test', 'fixtures', 'templates', 'article.html'), 'utf8'),
          jsonArticle: fse.readJsonSync(path.join(process.cwd(), 'test', 'fixtures', 'files', 'article-2.json')),
          jsonHomepage: fse.readJsonSync(path.join(process.cwd(), 'test', 'fixtures', 'data', 'homepage-1.json'))
        }
        done()
        
      }.bind(this))
  });

  it('cmsOperations.create()', function(done) {
    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj, body, json) {
      if (str == 'beforeFirstSave') {
        return {
          postUrl: obj,
          json: json
        }
      }
      return str, obj;
    }.bind(this));
    s.stub(coreUtils.slug, 'clean', function (p) { return p; }.bind(this));
    s.stub(Manager.instance, 'postExist', function (p) { return false; }.bind(this));
    s.stub(cmsData.metas, 'create', function (json, template, postUrl) { return json; }.bind(this));
    s.stub(cmsTemplates.template, 'getTemplate', function () { return this.fixture.htmlArticle; }.bind(this));
    s.stub(cmsData.values, 'removeDuplicate', function (templateText, json) { return json; }.bind(this));
    s.stub(cmsOperations.post, 'draft', function () {
      return Promise.resolve({json: JSON.parse(JSON.stringify(this.fixture.jsonArticle))})
    }.bind(this));

    cmsOperations.create('article', '', 'article-2.html', {query: ''}, JSON.parse(JSON.stringify(this.fixture.jsonArticle)), false)
      .then(function(resSave) {
        var json = path.join(config.root, config.data.url, resSave.abe_meta.latest.abeUrl.replace('.html', '.json'))
        
        abeExtend.hooks.instance.trigger.restore()
        coreUtils.slug.clean.restore()
        Manager.instance.postExist.restore()
        cmsData.metas.create.restore()
        cmsTemplates.template.getTemplate.restore()
        cmsData.values.removeDuplicate.restore()
        cmsOperations.post.draft.restore()

        done()
      }.bind(this));
  });

  /**
   * cmsOperations.post.publish
   * 
   */
  it('cmsOperations.post.publish()', function(done) {
    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj) { return str, obj; }.bind(this));
    s.stub(cmsTemplates.template, 'getTemplate', function () { return this.fixture.htmlArticle; }.bind(this));
    s.stub(cmsData.source, 'getDataList', function () {
      return Promise.resolve(JSON.parse(JSON.stringify(this.fixture.jsonArticle)))
    }.bind(this));
    s.stub(cmsData.utils, 'getPercentOfRequiredTagsFilled', function () { return 100; }.bind(this));
    // s.stub(Page, 'getPercentOfRequiredTagsFilled', function () { return 100; }.bind(this));
    s.stub(cmsOperations.save, 'saveHtml', function () { return 100; }.bind(this));
    s.stub(cmsOperations.save, 'saveJson', function () { return 100; }.bind(this));
    s.stub(Manager.instance, 'updatePostInList', function () { return null; }.bind(this));

    // test
    cmsOperations.post.publish('article-2.html', JSON.parse(JSON.stringify(this.fixture.jsonArticle)))
      .then(function(resSave) {
      // unstub
      abeExtend.hooks.instance.trigger.restore()
      cmsTemplates.template.getTemplate.restore()
      cmsData.source.getDataList.restore()
      cmsData.utils.getPercentOfRequiredTagsFilled.restore()
      cmsOperations.save.saveHtml.restore()
      cmsOperations.save.saveJson.restore()
      Manager.instance.updatePostInList.restore()
      done()
      }.bind(this));
  });

  /**
   * cmsOperations.post.unpublish
   * 
   */
  it('cmsOperations.post.unpublish()', function(done) {
    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj) { return str, obj; }.bind(this));
    s.stub(coreUtils.file, 'exist', function (revisionPath) { return true; }.bind(this));
    s.stub(cmsData.file, 'get', function () { return JSON.parse(JSON.stringify(this.fixture.jsonArticle)); }.bind(this));
    s.stub(cmsOperations.post, 'draft', function () {
      return Promise.resolve({json: JSON.parse(JSON.stringify(this.fixture.jsonArticle))})
    }.bind(this));
    s.stub(cmsOperations.remove, 'removeFile', function () { return null; }.bind(this));
    s.stub(Manager.instance, 'updatePostInList', function () { return null; }.bind(this));

    // test
    cmsOperations.post.unpublish('article-2.html')
    .then(function(resSave) {
      
      // unstub
      abeExtend.hooks.instance.trigger.restore()
      coreUtils.file.exist.restore()
      cmsData.file.get.restore()
      cmsOperations.post.draft.restore()
      cmsOperations.remove.removeFile.restore()
      Manager.instance.updatePostInList.restore()
      done()
    }.bind(this));
  });

  /**
   * cmsOperations.post.draft
   * 
   */
  it('cmsOperations.post.draft()', function(done) {
    var json = JSON.parse(JSON.stringify(this.fixture.jsonArticle))
    var meta = json.abe_meta
    delete json.abe_meta

    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj) { return str, obj; }.bind(this));
    s.stub(coreUtils.file, 'addDateIsoToRevisionPath', function (revisionPath) { return revisionPath; }.bind(this));
    s.stub(cmsData.metas, 'add', function (json) {
      json.abe_meta = meta
      return json;
    }.bind(this));
    s.stub(cmsTemplates.template, 'getTemplate', function () { return this.fixture.htmlArticle; }.bind(this));
    s.stub(cmsData.source, 'getDataList', function () {
      return Promise.resolve(JSON.parse(JSON.stringify(this.fixture.jsonArticle)))
    }.bind(this));
    s.stub(cmsOperations.save, 'saveJson', function () { return true; }.bind(this));
    s.stub(Manager.instance, 'updatePostInList', function () { return null; }.bind(this));
    s.stub(cmsData.utils, 'getPercentOfRequiredTagsFilled', function () { return 100; }.bind(this));

    // test
    cmsOperations.post.draft('article-2.html', JSON.parse(JSON.stringify(this.fixture.jsonArticle)))
      .then(function(resSave) {
        chai.expect(resSave.success).to.be.equal(1);
        chai.expect(resSave.json.abe_meta).to.not.be.undefined;
        
        // unstub
        abeExtend.hooks.instance.trigger.restore()
        coreUtils.file.addDateIsoToRevisionPath.restore()
        cmsData.utils.getPercentOfRequiredTagsFilled.restore()
        cmsData.metas.add.restore()
        cmsTemplates.template.getTemplate.restore()
        cmsData.source.getDataList.restore()
        cmsOperations.save.saveJson.restore()
        Manager.instance.updatePostInList.restore()

        done()
      }.bind(this));
  });

  /**
   * cmsOperations.post.reject
   * 
   */
  it('cmsOperations.post.reject()', function(done) {
    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj) { return str, obj; }.bind(this));
    s.stub(cmsOperations.post, 'draft', function (filePath, json, rejectToWorkflow) {
      chai.expect(rejectToWorkflow).to.be.equal("draft");
      return Promise.resolve(this.fixture.jsonArticle);
    }.bind(this));

    // test
    var json = JSON.parse(JSON.stringify(this.fixture.jsonArticle))
    json.abe_meta.status = 'publish'
    cmsOperations.post.reject('article-2.html', json)
      .then(function(resSave) {
        chai.expect(resSave.abe_meta).to.not.be.undefined;

        // unstub
        abeExtend.hooks.instance.trigger.restore()
        cmsOperations.post.draft.restore()
        done()
      }.bind(this));
  });

  it('cmsOperations.duplicate()', function(done) {
    // stub
    var s = sinon.sandbox.create();
    s.stub(abeExtend.hooks.instance, 'trigger', function (str, obj) { return str, obj; }.bind(this));
    s.stub(Manager.instance, 'getList', function (str, obj) { return [this.fixture.jsonArticle]; }.bind(this));
    s.stub(coreUtils.slug, 'clean', function (p) { return p; }.bind(this));
    s.stub(coreUtils.array, 'filter', function () { return [this.fixture.jsonArticle]; }.bind(this));
    s.stub(cmsData.file, 'get', function () { return this.fixture.jsonArticle; }.bind(this));
    s.stub(cmsOperations, 'create', function () { return Promise.resolve(this.fixture.jsonArticle); }.bind(this));
    s.stub(cmsOperations.remove, 'remove', function () { return null; }.bind(this));

    // test
    var newPostUrl = 'article-2.html'
    cmsOperations.duplicate('article-1.html', 'article', '', newPostUrl, {}, false)
    .then(function(resSave) {
      chai.expect(resSave.abe_meta).to.not.be.undefined;
      chai.expect(resSave.abe_meta.link).to.be.equal('/article-2.html');

      cmsOperations.duplicate('article-1.html', 'article', '', newPostUrl, {}, true)
      .then(function(resSave2) {
        chai.expect(resSave2.abe_meta).to.not.be.undefined;
        chai.expect(resSave2.abe_meta.link).to.be.equal('/article-2.html');

        // unstub
        abeExtend.hooks.instance.trigger.restore()
        sinon.assert.calledTwice(Manager.instance.getList)
        Manager.instance.getList.restore()
        sinon.assert.calledTwice(coreUtils.slug.clean)
        coreUtils.slug.clean.restore()
        sinon.assert.calledTwice(coreUtils.array.filter)
        coreUtils.array.filter.restore()
        cmsData.file.get.restore()
        sinon.assert.calledTwice(cmsOperations.create)
        cmsOperations.create.restore()
        sinon.assert.calledOnce(cmsOperations.remove.remove)
        cmsOperations.remove.remove.restore()
        done()
      }.bind(this))
    }.bind(this))
  });
});
