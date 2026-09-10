/* 本地桩：替代原站 Cloudflare 统计脚本，只保留 GuqinStat 的接口面 */
(function () {
  'use strict';
  var listeners = [];
  window.GuqinStat = {
    hit: function () {},
    once: function () {},
    on: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    _local: true
  };
})();
