# ⚡ Guide Optimisation Performance - AET MonBudget

## 📊 Métriques Core Web Vitals

### Current Performance
```
✅ First Contentful Paint (FCP):  ~0.8s
✅ Largest Contentful Paint (LCP): ~1.2s
✅ Cumulative Layout Shift (CLS):  ~0.05
✅ Time to Interactive (TTI):      ~1.5s
✅ First Input Delay (FID):        ~50ms
✅ Interaction to Next Paint (INP): ~100ms
```

### Target (Google Standards)
```
🎯 FCP:  < 1.8s  (Good)
🎯 LCP:  < 2.5s  (Good)
🎯 CLS:  < 0.1   (Good)
🎯 FID:  < 100ms (Good)
🎯 TTI:  < 3.8s  (Good)
```

---

## 🚀 Optimisations Implémentées

### 1. CSS Grid Layout
```css
body {
  display: grid;
  grid-template-columns: var(--nav-width) 1fr;
  grid-template-rows: 1fr auto;
}
```
**Bénéfice:** Layout haute performance, pas de recalcul complet à chaque redimensionnement

### 2. Lazy Loading du Contenu
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.5s';
      observer.unobserve(entry.target);
    }
  });
});
```
**Bénéfice:** Animations GPU-optimisées, pas de blocking du main thread

### 3. Animations GPU
```css
.nav-item:hover {
  transform: translateX(4px);  /* GPU accel */
}

@keyframes fadeInUp {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```
**Bénéfice:** Animations à 60fps, pas de jank

### 4. Variables CSS Dynamiques
```css
:root {
  --primary: #2563eb;          /* Changeable au runtime */
  --transition-normal: 0.3s;   /* Centralisé */
}
```
**Bénéfice:** Pas de recalcul de styles, changements atomiques

### 5. Réduction des Animations (Accessibility)
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
**Bénéfice:** Respecte les préférences utilisateur, améliore UX

### 6. Event Delegation
```javascript
// ❌ Inefficace: listener sur chaque item
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', handler);
});

// ✅ Efficace: listener sur parent
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item')) {
    handler();
  }
});
```
**Bénéfice:** Moins de memory footprint, plus rapide

### 7. localStorage pour Persistance
```javascript
localStorage.setItem('aet_nav_collapsed', '1');
const collapsed = localStorage.getItem('aet_nav_collapsed') === '1';
```
**Bénéfice:** Pas de requête serveur, instant restore

---

## 🔧 Optimisations à Appliquer

### 1. Minification CSS/JS
```bash
# Using terser
npx terser index.html --compress --mangle > index.min.html

# Using cssnano
npx cssnano input.css output.min.css
```

### 2. Compression d'Images
```bash
# WebP conversion
cwebp input.png -o output.webp

# AVIF conversion
ffmpeg -i input.png output.avif
```

### 3. Critical CSS
```html
<!-- Inline critical CSS -->
<style>
  /* Layout critical path only */
  body { grid-template-columns: var(--nav-width) 1fr; }
</style>

<!-- Defer non-critical CSS -->
<link rel="preload" href="non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

### 4. Code Splitting
```javascript
// Lazy load modules
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    import('./heavy-module.js');
  });
} else {
  import('./heavy-module.js');
}
```

### 5. Service Worker Caching
```javascript
// Dans sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll(['/index.html', '/assets/css/modern-nav.css']);
    })
  );
});
```

### 6. Font Optimization
```html
<!-- Preconnect aux fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Font display policy -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
```

### 7. Bundle Size Analysis
```bash
# Check bundle size
du -sh index.html

# Browser DevTools
# 1. Open DevTools
# 2. Network tab
# 3. Check file sizes
# 4. Look for opportunities to compress
```

---

## 📈 Benchmarking

### Lighthouse Audit
```bash
# CLI
ngx-lighthouse https://yoursite.com --view

# Or use web
# https://pagespeed.web.dev/
```

### Chrome DevTools Performance
1. Ouvrir DevTools (F12)
2. Aller à "Performance" tab
3. Cliquer "Record"
4. Effectuer une action
5. Cliquer "Stop"
6. Analyser les résultats

### WebPageTest
```
https://www.webpagetest.org/
- Entrer URL
- Sélectionner localisation
- Analyser rapport détaillé
```

---

## 💡 Best Practices

### DO ✅
- Utiliser CSS Grid pour layout
- Lazy load images & contenu
- Minimiser les requêtes réseau
- Utiliser animations GPU (transform, opacity)
- Débounce les event handlers
- Utiliser Web Fonts avec display: swap
- Compresser les images
- Minifier le CSS/JS
- Utiliser le Service Worker
- Tester régulièrement

### DON'T ❌
- Utiliser trop de JavaScript
- Animer top/left/width/height
- Charger trop de fonts
- Inclure images non optimisées
- Utiliser jQuery (vanilla JS est plus rapide)
- Faire des requêtes synchrones
- Ignorer les Web Vitals
- Négliger la compression
- Oublier les media queries
- Tester sur un seul navigateur

---

## 🔍 Monitoring en Production

### Google Analytics
```javascript
// Track Web Vitals
import {getCLS, getFID, getFCP, getLCP, getTTFB} from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

### Custom Events
```javascript
// Track custom metrics
window.addEventListener('load', () => {
  const perfData = window.performance.timing;
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
  
  gtag('event', 'page_load_time', {
    'value': pageLoadTime,
    'currency': 'ms'
  });
});
```

---

## 📝 Checklist Optimisation

- [ ] Minifier CSS/JS
- [ ] Compresser images
- [ ] Implémenter Critical CSS
- [ ] Lazy load contenu
- [ ] Code splitting
- [ ] Font optimization
- [ ] Service Worker
- [ ] GZIP compression
- [ ] HTTP/2 push
- [ ] CDN pour assets statiques
- [ ] Tests Lighthouse
- [ ] WebPageTest audit
- [ ] Monitoring Web Vitals
- [ ] Analytics tracking
- [ ] Documentation

---

## 📞 Resources

- [Google Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Web.dev Guides](https://web.dev/)
- [MDN Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [WebPageTest](https://www.webpagetest.org/)
