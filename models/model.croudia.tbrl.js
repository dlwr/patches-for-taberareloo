// ==Taberareloo==
// {
//   "name"        : "Croudia Model"
// , "description" : "Post to croudia.com"
// , "include"     : ["background"]
// , "version"     : "0.1.0"
// , "downloadURL" : "https://raw.github.com/YungSang/patches-for-taberareloo/master/models/model.croudia.tbrl.js"
// }
// ==/Taberareloo==

(function () {
  Models.register({
    name      : 'Croudia',
    ICON      : 'https://croudia.com/favicon.ico',
    LOGIN_URL : 'https://croudia.com/',

    FORM_URL  : 'https://croudia.com/voices/written_ajax',
    POST_URL  : 'https://croudia.com/voices/write',

    check : function (ps) {
      return (/(regular|photo|quote|link|video)/).test(ps.type);
    },

    getForm : function () {
      var self = this;
      return request(this.FORM_URL, {responseType: 'document'}).addCallback(function (res) {
        var doc = res.response;
        var form = formContents(doc);
        if (!form.utf8) {
          throw new Error(chrome.i18n.getMessage('error_notLoggedin', self.name));
        }
        return form;
      });
    },

    createVoice : function (ps) {
      var maxlen = 372;

      var info = [ps.description, ps.description ? "\n" : ''];
      info.push(ps.body ? '"' + ps.body.trimTag().trim() + '"' : '');
      if (ps.type === 'photo') {
        info.push('(via ' + ps.item + ' ' + ps.pageUrl + ' )');
      }
      else {
        info.push('(via ' + ps.item + ' ' + ps.itemUrl + ' )');
      }
      var tags = joinText(ps.tags, ' #');
      if (tags) {
        info.push('#' + tags);
      }
      var voice = joinText(info, "\n", true).replace(/(\n){2,}/gm, "\n\n");

      if (voice.length > maxlen) {
        throw new Error('too many characters to post (' + (voice.length - maxlen) + ' over)');
      }
      return voice;
    },

    post : function (ps) {
      return this.update(ps, this.createVoice(ps));
    },

    update : function (ps, voice) {
      var self = this;

      return self.getForm().addCallback(function(form) {
        delete form.commit;
        delete form['image_file[file]'];
        form.utf8 = '✓';
        form['voice[tweet]'] = voice;
        return ((ps.type === 'photo') ? self.download(ps) : succeed(null)).addCallback(function(file) {
          if (file) {
            form['image_file[file]'] = file;
          }
          return request(self.POST_URL, {
            sendContent : form,
            multipart   : true
          }).addCallback(function(res) {
            var error = res.responseText.extract(/window.parent.error_popup\('(.+)'\);/);
            if (error) {
              throw new Error(error);
            }
          });
        });
      });
    },

    download : function (ps) {
      return (
        ps.file ? succeed(ps.file)
          : download(ps.itemUrl).addCallback(function(entry) {
            return getFileFromEntry(entry);
          })
      );
    }
  });

  addAround(Models['Croudia'], 'createVoice', function(proceed, args, target, methodName) {
    var ps = update({}, args[0]);
    if (ps.body) {
      ps.body = ps.body.trimTag().replace(/\s+/g, ' ');
    }
    try {
      return proceed([ps]);
    }
    catch (e) {
console.log(e.message);
      var over = e.message.extract(/post \((\d+) over\)/);
      if (!over) {
        throw e;
      }
      var len;
      if (ps.body) {
        len = ps.body.length;
        ps.body = ps.body.slice(0, -1 * over);
        over -= len;
      }
      if ((over > 0) && ps.description) {
        len = ps.description.length;
        ps.description = ps.description.slice(0, -1 * over);
        over -= len;
      }
      if (over > 0) {
        len = 0;
        if ((ps.type === 'photo') && ps.page) {
          len = ps.page.length;
          ps.page = ps.page.slice(0, -1 * over);
        }
        else if (ps.item) {
          len = ps.item.length;
          ps.item = ps.item.slice(0, -1 * over);
        }
        over -= len;
      }
      if (over > 0) {
        throw e;
      }
      return target[methodName](ps);
    }
  });
})();
