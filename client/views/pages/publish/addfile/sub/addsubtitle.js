var languages = require('languages')

Template.addsubtitle.rendered = function () {
    var langscodes = languages.getAllLanguageCode();
    var langs = []
    for (n=0; n<langscodes.length; n++) {
        var lang = languages.getLanguageInfo(langscodes[n])
        var newLang = {
            title: lang.nativeName,
            description: lang.name,
            code: langscodes[n]
        }
        langs.push(newLang)
    }
    $('.ui.search').search({
      source: langs
    })
    Session.set('isAddingSubtitle', false)
}

Template.addsubtitle.helpers({
    isAddingSubtitle: function() {
        return Session.get('isAddingSubtitle')
    }
})


Template.addsubtitle.events({
    'click #addvideoback': function() {
        Session.set('addVideoStep', 'addvideopublish')
    },
    'click #createSubtitle': function() {
        var nativeName = $('#subtitleLanguage').val()
        var langscodes = languages.getAllLanguageCode();
        for (n=0; n<langscodes.length; n++) {
            var lang = languages.getLanguageInfo(langscodes[n])
            if (lang.nativeName == nativeName) {
                Session.set('isAddingSubtitle', langscodes[n])
                break;
            }
        }
    },
    'change #importSubtitleFile': function(event) {
        var file = event.currentTarget.files[0]
        console.log(file)

        var reader = new FileReader();
        reader.onload = function(){
          console.log(reader.result);
          if (reader.result.slice(0,6) != 'WEBVTT')
            $('#subtitleText')[0].innerHTML = srt2webvtt(reader.result)
          else
          $('#subtitleText')[0].innerHTML = reader.result
        }
        reader.readAsText(event.currentTarget.files[0])
    },
    'click #uploadSubtitle': function() {
        $('#uploadSubtitle').addClass('disabled')
        $('#uploadSubtitle > i').removeClass('cloud upload red')
        $('#uploadSubtitle > i').addClass('asterisk loading')
        $('#uploadSubtitle > i').css('background', 'transparent')
        var postUrl = 'https://snap1.d.tube/uploadSubtitle'
        var formData = new FormData();
        if (Session.get('uploadEndpoint') === 'uploader.oneloved.tube') {
          postUrl = 'https://uploader.oneloved.tube/uploadSubtitle?access_token=' + Session.get('Upload token for uploader.oneloved.tube')
        } else {
          formData.append('subtitle', $('#subtitleText').val());
        }
        let ajaxUploadSubtitle = {
            url: postUrl,
            type: "POST",
            data: formData,
            xhr: function () {
              var xhr = new window.XMLHttpRequest();
              xhr.upload.addEventListener("progress", function (evt) {
                if (evt.lengthComputable) {
                  //$(progressid).progress({ value: evt.loaded, total: evt.total });
                  if (evt.loaded == evt.total) {
                    // $(progressid).progress({ value: evt.loaded, total: evt.total });
                    // $('#progressvideo > .label').html('File received. Requesting Token...')
                  }
                }
              }, false);
              return xhr;
            },
            cache: false,
            contentType: false,
            processData: false,
            success: function (result) {
              if (Session.get('uploadEndpoint') === 'uploader.oneloved.tube') {
                addSubtitle({
                  lang: Session.get('isAddingSubtitle'),
                  hash: result.hash
                })
                Session.set('isAddingSubtitle', false)
                return console.log(result)
              }
                refreshUploadSubtitleStatus = setInterval(function () {
                    var url = 'https://snap1.d.tube/getProgressByToken/' + result.token
                    $.getJSON(url, function (data) {
                      var isCompleteUpload = true
                      if (data.ipfsAddSource.progress !== "100.00%")
                        isCompleteUpload = false;

                      if (isCompleteUpload) {
                        clearInterval(refreshUploadSubtitleStatus)
                        addSubtitle({
                            lang: Session.get('isAddingSubtitle'),
                            hash: data.ipfsAddSource.hash
                        })
                        Session.set('isAddingSubtitle', false)
                      }
                    })
                }, 1000)
            },
            error: function (error) {
                console.log(error)
            }
        }

        if (Session.get('uploadEndpoint') === 'uploader.oneloved.tube') {
          ajaxUploadSubtitle.data = $('#subtitleText').val()
        }
        $.ajax(ajaxUploadSubtitle)
    }
})

function addSubtitle(sub) {
    var files = Session.get('tmpVideo').json.files
    if (!files.ipfs) 
        files.ipfs = {}
    if (!files.ipfs.sub)
        files.ipfs.sub = {}
    files.ipfs.sub[sub.lang] = sub.hash
    Template.addvideo.tmpVid({files: files})
    Session.set('addVideoStep', 'addvideopublish')
}
  
function srt2webvtt(data) {
    // remove dos newlines
    var srt = data.replace(/\r+/g, '');
    // trim white space start and end
    srt = srt.replace(/^\s+|\s+$/g, '');

    // get cues
    var cuelist = srt.split('\n\n');
    var result = "";

    if (cuelist.length > 0) {
        result += "WEBVTT\n\n";
        for (var i = 0; i < cuelist.length; i=i+1) {
            result += convertSrtCue(cuelist[i]);
        }
    }

    return result;
}
  
function convertSrtCue(caption) {
    // remove all html tags for security reasons
    //caption = caption.replace(/<[a-zA-Z\/][^>]*>/g, ''); 
    
    var cue = "";
    var s = caption.split(/\n/);
    while (s.length > 3) {
      s[2] += '\n' + s.pop();
    }
    var line = 0;
    
    // detect identifier
    if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
      cue += s[0].match(/\w+/) + "\n";
      line += 1;
    }
    
    // get time strings
    if (s[line].match(/\d+:\d+:\d+/)) {
      // convert time string
      var m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/);
      if (m) {
        cue += m[1]+":"+m[2]+":"+m[3]+"."+m[4]+" --> "
              +m[5]+":"+m[6]+":"+m[7]+"."+m[8]+"\n";
        line += 1;
      } else {
        // Unrecognized timestring
        return "";
      }
    } else {
      // file format error or comment lines
      return "";
    }
    
    // get cue text
    if (s[line]) {
      cue += s[line] + "\n\n";
    }
  
    return cue;
}