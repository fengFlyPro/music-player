import Zepto from 'zepto'

!($ => {
  let audio
  const audioCache = {}

  const $musicBgImg = $('#music-bgimg')
  const $musicRadio = $('#music-radio')
  const $musicRadios = $('#music-radios')
  const $musicPic = $('#music-pic')
  const $musicCtime = $('#music-ctime')
  const $musicDtime = $('#music-dtime')
  const $musicPlayed = $('#music-played')
  const $musicLoaded = $('#music-loaded')
  const $musicPrev = $('#music-prev')
  const $musicPlay = $('#music-play')
  const $musicNext = $('#music-next')
  const $musicVolume = $('#music-volume')
  const $musicMute = $('#music-mute')
  const $musicShowlist = $('#music-showlist')
  const $musicView = $('#music-view')
  const $musicList = $('#music-list')
  const $musicDetail = $('#music-detail')
  const $musicLrc = $('#music-lrc')
  const $musicLoading = $('#music-loading')

  const defaults = {
    songlist: [
      {
        songid: '',
        songmid: '',
        songname: '',
        albummid: '',
        albumname: '',
        singer: '',
        duration: ''
      }
    ],
    showlrc: true,
    useRadio: false,
    autoplay: false,
    playIndex: 0,
    cacheTime: 86400,
    loop: 'list',
    preload: 'metadata'
  }

  class Qplayer {
    constructor (elmt, options) {
      this.settings = $.extend(defaults, options)
      this.total = this.settings.songlist.length
      this.playIndex = this.settings.playIndex
      this.cacheTime = this.settings.cacheTime
      this.loadedTime = null
      this.playTime = null
      this.lrcTime = null
      this.soundTime = null
      this.playing = false
      this.ended = false
      this.radioId = 0
      this.storage = window.localStorage
      this.support = !!document.createElement('audio').canPlayType('audio/mpeg')
      this.isMobile = !!/(Android|webOS|Phone|iPad|iPod|BlackBerry|Windows Phone)/i.test(
        navigator.userAgent
      )
      this.radioUrl = `${document.URL}?do=getRadios`
      // this.mp3Url = 'http://vsrc.music.tc.qq.com/M800{songmid}.mp3'
      this.m4aUrl =
        'http://dl.stream.qqmusic.qq.com/C100{songmid}.m4a?fromtag=38'
      this.picUrl =
        'https://qzonestyle.gtimg.cn/music/photo_new/T002R500x500M000{albummid}.jpg'
      this.lrcUrl = `${document.URL}?do=getLrc&songid={songid}`

      if (this.settings.useRadio) {
        this._radio()
      } else {
        this._init()
      }

      const self = this
      $musicPlay.on('click', function () {
        if (!audio) return
        if ($(this).hasClass('play')) {
          self.trigger('play')
        } else if ($(this).hasClass('pause')) {
          self.trigger('pause')
        }
      })

      $musicPrev.on('click', () => {
        if (!audio) return
        self.trigger('prev')
      })

      $musicNext.on('click', () => {
        if (!audio) return
        self.trigger('next')
      })

      $musicMute.on('click', function () {
        if (!audio) return
        if (audio.muted) {
          audio.muted = false
          self._updateBar('volume', self.volume)
          $(this).removeClass('mute-off')
        } else {
          audio.muted = true
          self._updateBar('volume', 0)
          $(this).addClass('mute-off')
        }
      })

      $musicList.on('click', 'li', function () {
        if (!audio) return
        self.playIndex = $(this).index()
        self.autoPlaying = !!self.playing
        self.trigger('pause')
        audio.pause()
        self._goto($(this).index())
      })

      $musicVolume.parent().on('click', function (e) {
        if (!audio) return
        const offX = self._getOffsetX(e)
        const barWidth = $(this).width()
        const percentage = parseFloat(offX / barWidth).toFixed(2)
        if (!audio) return
        self.volume = percentage
        audio.volume = percentage
        self._storageSet('musicVolume', percentage)
        self._updateBar('volume', percentage)
      })

      $musicPlayed.parent().on('click', function (e) {
        if (!audio) return
        const offX = self._getOffsetX(e)
        const barWidth = $(this).width()
        const percentage = parseFloat(offX / barWidth).toFixed(2)
        if (!audio) return
        audio.currentTime = percentage * audio.duration
        self._updateTime('ctime', percentage * audio.duration)
        self._updateBar('played', percentage)
      })

      $musicShowlist.on('click', () => {
        if (!audio) return
        if ($('body').width() < 641) {
          $musicPic.addClass('music__trans__left')
          $musicView.addClass('music__trans__none')
        }
        $musicRadios.removeClass('view__active')
        $musicList.removeClass('view__hide').toggleClass('view__active')
        $musicDetail.removeClass('view__hide').toggleClass('view__active')
      })

      $musicRadio.on('click', () => {
        if ($('body').width() < 641) {
          $musicPic.toggleClass('music__trans__left')
          $musicView.toggleClass('music__trans__none')
          $musicList.addClass('view__hide')
          $musicDetail.addClass('view__hide')
          $musicRadios.addClass('view__active')
        } else {
          $musicList.toggleClass('view__hide')
          $musicDetail.toggleClass('view__hide')
          $musicRadios.toggleClass('view__active')
        }
      })

      $musicRadios.on('click', 'li', function () {
        const rid = $(this).data('rid')
        if ($.isNumeric(rid)) {
          self.trigger('pause')
          audio.pause()
          $musicRadios.find('li').removeClass('playing')
          $(this).addClass('playing')
          self.radioId = rid
          self._storageSet('musicRadioId', rid)
          self._getSongList(rid, true)
        }
      })
    }

    _init () {
      const playIndex = this._storageGet('musicPlayIndex')
      if (playIndex) {
        this.playIndex = playIndex
      }
      const songs = this.settings.songlist[this.playIndex]

      this._updateList(this.settings.songlist)

      if (!songs.songid || !songs.songmid) {
        if (this.total > 1) {
          this.settings.songlist.splice(this.playIndex, this.playIndex + 1)
          this.next()
        } else {
          this.error()
        }
      } else {
        this._goto(this.playIndex)
      }
    }

    _loading (status) {
      if (status) {
        $musicLoading.removeClass('loading__over')
      } else {
        if (this.loadedTime) {
          clearTimeout(this.loadedTime)
        }
        this.loadedTime = setTimeout(() => {
          $musicLoading.addClass('loading__over')
        }, 500)
      }
    }

    _audio (srcs) {
      let _audio
      let _source
      const cacheKey = srcs.toString()

      if (audioCache[cacheKey]) {
        _audio = audioCache[cacheKey]
      } else {
        _audio = document.createElement('audio')
        srcs.forEach(src => {
          _source = document.createElement('source')
          _source.src = src
          _audio.appendChild(_source)
        })
        audioCache[cacheKey] = _audio
      }
      return _audio
    }

    _secondToTime (second) {
      const min = parseInt(second / 60)
      const sec = parseInt(second - min * 60)
      const add0 = num => (num < 10 ? `0${num}` : `${num}`)
      return `${add0(min)}:${add0(sec)}`
    }

    _getOffsetX (event = window.event) {
      const target = event.target || event.srcElement
      return (
        event.offsetX || event.clientX - target.getBoundingClientRect().left
      )
    }

    _validTime (data) {
      if (
        !data ||
        !data.hasOwnProperty('data') ||
        !data.hasOwnProperty('timestamp')
      ) {
        return
      }
      return data.timestamp + this.cacheTime > Date.parse(new Date()) / 1000
    }

    _parseLrc (lrc) {
      let lrcText = ''
      let lrcHTML = ''
      let lrcTimes = null
      const lrcs = []
      const lyric = lrc.split('\n')
      const lyricLen = lyric.length

      for (var i = 0; i < lyricLen; i++) {
        lrcTimes = lyric[i].match(/\[(\d{2}):(\d{2})\.(\d{2,3})]/g)
        lrcText = lyric[i]
          .replace(/\[(\d{2}):(\d{2})\.(\d{2,3})]/g, '')
          .replace(/^\s+|\s+$/g, '')

        if (lrcTimes != null) {
          const timeLen = lrcTimes.length
          for (let j = 0; j < timeLen; j++) {
            const oneTime = /\[(\d{2}):(\d{2})\.(\d{2,3})]/.exec(lrcTimes[j])
            const lrcTime =
              oneTime[1] * 60 +
              parseInt(oneTime[2]) +
              parseInt(oneTime[3]) /
                ((oneTime[3] + '').length === 2 ? 100 : 1000)
            lrcs.push([lrcTime, lrcText])
          }
        }
      }

      lrcs.sort((a, b) => a[0] - b[0])

      for (let i = 0; i < lrcs.length; i++) {
        if (!lrcs[i][1]) {
          continue
        }
        const cls = i === 0 && lrcs.length > 1 ? ' class="active"' : ''
        lrcHTML += `<p${cls} data-time="${lrcs[i][0]}">${lrcs[i][1]}</p>`
      }

      $musicLrc.html(lrcHTML).fadeIn(200)
    }

    _storageGet (key) {
      if (this.storage) {
        return $.parseJSON(this.storage.getItem(key))
      }
    }

    _storageSet (key, val) {
      if (!this.storage) {
        return
      }
      if (Math.round(JSON.stringify(this.storage).length / 1024) > 1000) {
        this.storage.clear()
      }
      return this.storage.setItem(key, JSON.stringify(val))
    }

    _random (array) {
      return array[Math.floor(Math.random() * array.length)]
    }

    _fadeInSound (audio, duration) {
      const self = this
      const delay = duration / 10
      const volume = audio.volume + 0.1
      if (this.soundTime) {
        clearTimeout(this.soundTime)
      }
      if (volume <= this.volume) {
        audio.volume = volume
        this.soundTime = setTimeout(() => {
          self._fadeInSound(audio, duration)
        }, delay)
      }
    }

    _fadeOutSound (audio, duration) {
      const self = this
      const delay = duration / 10
      const volume = audio.volume - 0.1
      if (this.soundTime) {
        clearTimeout(this.soundTime)
      }
      if (volume >= 0) {
        audio.volume = volume
        this.soundTime = setTimeout(() => {
          self._fadeOutSound(audio, duration)
        }, delay)
      } else {
        audio.pause()
      }
    }

    _updateInfo (song) {
      song = $.extend(
        {
          songname: '暂无歌曲名',
          singer: '未知',
          albumname: '未知',
          pic: 'https://od9jg7suh.qnssl.com/music.jpg'
        },
        song
      )
      $musicBgImg.css({
        'background-image': `url(${song.pic})`
      })
      $musicPic.find('img').attr('src', song.pic).fadeIn(200)
      $musicDetail
        .find('.title')
        .text(song.songname)
        .attr('title', song.songname)
        .fadeIn(200)
      $musicDetail
        .find('.singer')
        .text(song.singer)
        .attr('title', song.singer)
        .fadeIn(200)
      $musicDetail
        .find('.album')
        .text(song.albumname)
        .attr('title', song.albumname)
        .fadeIn(200)
      document.title = `${song.songname} - ${song.singer} - 音乐听`
    }

    _updateList (list) {
      if (!$.isArray(list)) {
        this.trigger('error', '(ーー゛) 无效的歌曲列表')
        return
      }
      const self = this
      let __temp = `<h3 class="title">歌曲列表 <small>(共${list.length}首)</small></h3>`
      __temp += '<ul>'
      $.each(list, (i, song) => {
        __temp += '<li>'
        __temp += `<div class="name" title="${song.songname}">${song.songname}</div>`
        __temp += `<div class="singer" title="${song.singer}">${song.singer}</div>`
        __temp += `<div class="time">${self._secondToTime(song.duration)}</div>`
        __temp += '</li>'
      })
      __temp += '</ul>'
      $musicList.html(__temp)
    }

    _updateRadios (radios) {
      if (!$.isArray(radios)) {
        this.trigger('error', '(ToT)/ 找不到电台')
        return
      }
      let __temp = ''
      let radioId = this._storageGet('musicRadioId')

      if (!radioId) {
        radioId = radios[0].rid
        this._storageSet('musicRadioId', radioId)
      }

      this.radioId = radioId

      $.each(radios, (i, radio) => {
        __temp += `<li data-rid=${radio.rid}><img src="${radio.pic}"><p>${radio.name}</p></li>`
      })

      $musicRadios.html(__temp)
      $musicRadio.addClass('music__radio__on')
      $musicRadios.find(`li[data-rid="${radioId}"]`).addClass('playing')

      this._getSongList(radioId)
    }

    _updateTime (type, time) {
      time = $.isNumeric(time) ? time : 0
      if (type === 'ctime') {
        $musicCtime.html(this._secondToTime(time))
      }
      if (type === 'dtime') {
        $musicDtime.html(this._secondToTime(time))
      }
    }

    _updateBar (type, percentage) {
      percentage = percentage > 0 ? percentage : 0
      percentage = percentage < 1 ? percentage : 1
      if (type === 'played') {
        $musicPlayed.css({ width: `${percentage * 100}%` })
      }
      if (type === 'loaded') {
        $musicLoaded.css({ width: `${percentage * 100}%` })
      }
      if (type === 'volume') {
        $musicVolume.css({ width: `${percentage * 100}%` })
      }
    }

    _updateLrc (time) {
      let top = 0
      $musicLrc.find('p').each(function (i) {
        if (time >= $(this).data('time') - 0.5) {
          $(this).addClass('active').siblings('p').removeClass('active')
          top += $(this)[0].scrollHeight
        }
      })
      $musicLrc.parent().scrollTo({
        to: top,
        durTime: 500
      })
    }

    _goto (index) {
      if (typeof this.settings.songlist[index] === 'undefined') {
        index = 0
      }

      this._storageSet('musicPlayIndex', index)
      this.playIndex = index
      this.ended = false
      this.radioId = this._storageGet('musicRadioId') || 0

      const self = this
      const songs = this.settings.songlist[index]

      // const _mp3Url = this.mp3Url.replace('{songmid}', songs.songmid)
      const _m4aUrl = this.m4aUrl.replace('{songmid}', songs.songmid)
      const _picUrl = this.picUrl.replace('{albummid}', songs.albummid)
      const _lrcUrl = this.lrcUrl.replace('{songid}', songs.songid)

      songs.pic = _picUrl

      // audio = this._audio([_mp3Url, _m4aUrl])
      audio = this._audio([_m4aUrl])

      if (!this.support || !audio) {
        this.trigger('error', '您的浏览器不支持 HTML5 音乐播放功能')
        return
      }

      this._updateInfo(songs)

      audio.preload = this.settings.preload ? this.settings.preload : 'metadata'

      if (this.settings.showlrc) {
        const lrcCache = this._storageGet(`lrc_${songs.songid.toString()}`)
        if (this._validTime(lrcCache)) {
          this._parseLrc(lrcCache.data)
        } else {
          this._loading(true)
          $.getJSON(_lrcUrl, r => {
            if (r.data) {
              self._storageSet(`lrc_${songs.songid.toString()}`, {
                data: r.data,
                timestamp: Date.parse(new Date()) / 1000
              })
              self._parseLrc(r.data)
            } else {
              self._parseLrc('[00:00.00]暂无歌词信息')
            }
            self._loading(false)
          })
        }
      }

      if (audio.readyState === 4) {
        audio.currentTime = 0
      }

      if (this.isMobile) {
        self._loading(false)
      }

      if (this.settings.autoplay || this.autoPlaying) {
        this.trigger('play')
      }

      $(audio).on('playing', () => {
        if (self.lrcTime) {
          clearInterval(self.lrcTime)
        }
        if (self.settings.showlrc) {
          self.lrcTime = setInterval(() => {
            self._updateLrc(audio.currentTime)
          }, 1000)
        }
      })

      $(audio).on('pause', () => {
        if (self.lrcTime) {
          clearInterval(self.lrcTime)
        }
      })

      $(audio).on('timeupdate', () => {
        self._updateTime('ctime', audio.currentTime)
        self._updateBar('played', audio.currentTime / audio.duration)
      })

      $(audio).on('progress', () => {
        const percentage = audio.buffered.length
          ? audio.buffered.end(audio.buffered.length - 1) / audio.duration
          : 0
        self._updateBar('loaded', percentage)
      })

      $(audio).on('canplay', () => {
        let volume = self._storageGet('musicVolume')
        if (!volume) {
          self._storageSet('musicVolume', 0.5)
          volume = 0.5
        }
        self.volume = volume
        audio.volume = volume
        self._loading(false)
        self._updateBar('volume', volume)
        self._updateTime('dtime', audio.duration)
      })

      $(audio).on('error', () => {
        self.trigger('error')
      })

      $(audio).on('ended', () => {
        self.ended = true
        self.trigger('next')
      })
    }

    _getSongList (radioId, update) {
      update = update || false
      const self = this
      const songlist = this._storageGet('musicList')
      if (this._validTime(songlist) && !update) {
        this.settings.songlist = songlist.data
        this.total = songlist.data.length
        this._init()
      } else {
        this._loading(true)
        $.getJSON(`${this.radioUrl}&rid=${radioId}`, r => {
          if (r.data && $.isArray(r.data)) {
            self.settings.songlist = r.data
            self.total = r.data.length
            self._storageSet('musicList', {
              data: r.data,
              timestamp: Date.parse(new Date()) / 1000
            })
            self._init()
          }
          self._loading(false)
        })
      }
    }

    _radio () {
      const self = this
      const radios = this._storageGet('musicRadios')
      if (this._validTime(radios)) {
        this._updateRadios(radios.data)
      } else {
        this._loading(true)
        $.getJSON(this.radioUrl, r => {
          if (r.data && $.isArray(r.data)) {
            self._storageSet('musicRadios', {
              data: r.data,
              timestamp: Date.parse(new Date()) / 1000
            })
            self._updateRadios(r.data)
          } else {
            self.trigger('error', '╮（╯＿╰）╭ 电台载入失败')
          }
          self._loading(false)
        })
      }
    }

    play () {
      if (!this.playing) {
        this.playing = true
        $musicPlay.removeClass('play').addClass('pause')
        $musicList.find('li').removeClass('playing')
        $musicList.find('li').eq(this.playIndex).addClass('playing')
        $musicMute.addClass('mute-on')
        audio.volume = 0
        audio.play()
        this._fadeInSound(audio, 1000)
      }
    }

    pause () {
      if (this.playing || this.ended) {
        this.playing = false
        this.ended = false
        this._fadeOutSound(audio, 1000)
        $musicPlay.removeClass('pause').addClass('play')
        $musicMute.removeClass('mute-on')
        if (this.isMobile) {
          audio.pause()
        }
      }
    }

    prev () {
      this.playIndex--
      if (this.playIndex < 0) {
        this.playIndex = this.total - 1
      }
      this.autoPlaying = !!this.playing
      this.trigger('pause')
      audio.pause()
      this._goto(this.playIndex)
    }

    next () {
      this.playIndex++
      this.autoPlaying = !!this.playing
      this.trigger('pause')
      audio.pause()
      if (this.playIndex >= this.total) {
        this.playIndex = 0
        if ($.isNumeric(this.radioId) && this.radioId > 1) {
          this._storageSet('musicPlayIndex', 0)
          this._getSongList(this.radioId, true)
          return
        }
      }
      this._goto(this.playIndex)
    }

    error (title) {
      this._updateInfo({
        songname: title || '(°ー°〃) 音乐加载失败了'
      })
      this.trigger('pause')
    }

    trigger (event, params) {
      this[event](params)
    }
  }

  $.fn.scrollTo = function (options) {
    let index = 0
    let timer = null
    const opts = $.extend(defaults, options)
    const _this = this
    const curTop = _this.scrollTop()
    const subTop = opts.to - curTop
    const dur = Math.round(opts.durTime / opts.delay)

    const defaults = {
      to: 0,
      durTime: 350,
      delay: 10,
      callback: null
    }

    const smoothScroll = t => {
      index++
      const per = Math.round(subTop / dur)
      if (index >= dur) {
        _this.scrollTop(t)
        window.clearInterval(timer)
        if (opts.callback && typeof opts.callback === 'function') {
          opts.callback()
        }
        return
      } else {
        _this.scrollTop(curTop + index * per)
      }
    }

    timer = window.setInterval(() => {
      smoothScroll(opts.to)
    }, opts.delay)
    return _this
  }

  $.fn.Qplayer = function (options) {
    let returns
    let error = false
    const args = arguments

    if (options === undefined || typeof options === 'object') {
      return this.each(function () {
        if (!this._Qplayer) {
          this._Qplayer = new Qplayer(this, options)
        }
      })
    } else if (typeof options === 'string') {
      this.each(function () {
        const instance = this._Qplayer
        if (!instance) {
          throw new Error('No Qplayer applied to this element.')
        }

        if (typeof instance[options] === 'function' && options[0] !== '_') {
          returns = instance[options](...[].slice.call(args, 1))
        } else {
          error = true
        }
      })

      if (error) {
        throw new Error(`No method "${options}" in Qplayer.`)
      }

      return returns !== undefined ? returns : this
    }
  }

  $.Qplayer = {}
  $.Qplayer.defaults = defaults
})(Zepto)
