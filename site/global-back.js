(function(){
  /* 左上角统一返回首页键。首页与弹窗不放这个键；页面若已自带返回控件
     （#qinBack、.map-back、.page-back），这里就不再重复添加。 */
  if (document.querySelector('.global-page-back,.page-back,.map-back,#qinBack')) return;
  const english = document.documentElement.lang.toLowerCase().startsWith('en')
    || new URLSearchParams(location.search).get('lang') === 'en';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'global-page-back';
  button.textContent = '←';
  button.setAttribute('aria-label', english ? 'Back to home' : '返回首页');
  button.addEventListener('click', function(){
    location.href = '/';
  });
  document.body.appendChild(button);
})();
