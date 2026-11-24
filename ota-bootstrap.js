/* SHEIN AL-NEEL — safe web-content OTA updater
 * Runs only inside the bundled Android WebView. It never downloads or installs an APK.
 * Updated HTML is served from the current origin by the service worker, preserving IndexedDB/localStorage.
 */
(() => {
  'use strict';
  const REMOTE_HTML = 'https://raw.githubusercontent.com/mmdeedn-crypto/SHEINAL-NEEL-mws7hiotccn/main/index.html';
  const CACHE_KEY = 'shein-neel-ota-html-v1';
  const META_NAME = 'shein-ota-applied';
  let checking = false;

  const readCache = () => { try { return localStorage.getItem(CACHE_KEY); } catch (_) { return null; } };
  const writeCache = value => { try { localStorage.setItem(CACHE_KEY, value); return true; } catch (_) { return false; } };

  async function digest(value) {
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      let h = 2166136261;
      for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
      return 'fallback-' + (h >>> 0).toString(16) + '-' + value.length;
    }
  }

  function prepare(html, version) {
    const marker = '<meta name="' + META_NAME + '" content="' + version + '">';
    const loader = '<script src="./ota-bootstrap.js"></script>';
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, '<head$1>' + marker + loader);
    return html;
  }

  async function apply(html, version) {
    try {
      // Keep the same WebView origin so localStorage and IndexedDB stay intact.
      if (!writeCache(html)) throw new Error('تعذر حفظ نسخة التحديث');
      document.open();
      document.write(prepare(html, version));
      document.close();
    } catch (error) {
      console.error('OTA apply failed:', error);
      alert('تعذر تطبيق التحديث حالياً. بياناتك لم تتغير، حاول مرة أخرى بعد قليل.');
    }
  }

  function showUpdate(html, version) {
    const display = () => {
      if (!document.body || document.getElementById('sheinOtaNotice')) return;
      const bar = document.createElement('div');
      bar.id = 'sheinOtaNotice';
      bar.dir = 'rtl';
      bar.style.cssText = 'position:fixed;z-index:2147483647;top:calc(10px + env(safe-area-inset-top,0px));left:12px;right:12px;max-width:560px;margin:auto;padding:13px 14px;border-radius:15px;background:#26351c;color:#fff;box-shadow:0 8px 30px #0004;display:flex;align-items:center;justify-content:space-between;gap:12px;font:600 14px Cairo,Tahoma,sans-serif';
      const label = document.createElement('span');
      label.textContent = 'يتوفر تحديث جديد للتطبيق';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'تحديث الآن';
      button.style.cssText = 'border:0;border-radius:10px;padding:9px 13px;background:#dce8bd;color:#26351c;font-weight:800;font:inherit;white-space:nowrap';
      button.addEventListener('click', () => {
        if (!confirm('سيتم تحديث واجهة التطبيق وإعادة تحميلها. بيانات المتجر والعمليات المحفوظة محلياً تبقى كما هي. هل تريد التحديث الآن؟')) return;
        apply(html, version);
      });
      bar.append(label, button);
      document.body.appendChild(bar);
    };
    if (document.body) display();
    else document.addEventListener('DOMContentLoaded', display, { once: true });
  }

  async function checkForUpdate() {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const response = await fetch(REMOTE_HTML + '?ota=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const html = await response.text();
      if (!/<html[\s>]/i.test(html) || html.length < 1000) throw new Error('Invalid update content');
      const latestVersion = await digest(html);
      const cached = readCache();
      if (!cached) {
        writeCache(html);
        return;
      }
      const cachedVersion = await digest(cached);
      if (latestVersion !== cachedVersion) showUpdate(html, latestVersion);
    } catch (error) {
      console.info('OTA check skipped; using the installed/cached app.', error);
    } finally {
      checking = false;
    }
  }

  // Restore the last verified web version before the app's own scripts run.
  const applied = document.querySelector('meta[name="' + META_NAME + '"]');
  if (applied) window.SHEIN_OTA_VERSION = (applied.content || '').slice(0, 8);
  const cachedAtLaunch = readCache();
  if (!applied && cachedAtLaunch) {
    digest(cachedAtLaunch).then(version => apply(cachedAtLaunch, version));
    return;
  }

  window.checkSheinOta = checkForUpdate;
  checkForUpdate();
  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });
  window.setInterval(checkForUpdate, 10 * 60 * 1000);
})();
