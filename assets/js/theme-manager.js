/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎨 THEME MANAGER - Gestionnaire de Thème Dark/Light
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('aet_theme') || 'dark';
    this.themes = {
      dark: {
        '--bg-primary': '#0f172a',
        '--bg-secondary': '#1e293b',
        '--text-primary': '#f1f5f9',
        '--text-muted': '#94a3b8',
      },
      light: {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f8fafc',
        '--text-primary': '#0f172a',
        '--text-muted': '#64748b',
      }
    };
    this.init();
  }

  /**
   * Initialise le gestionnaire de thème
   */
  init() {
    this.applyTheme(this.currentTheme);
    this.createThemeToggle();
    this.setupSystemPreference();
    console.log('✅ ThemeManager initialized');
  }

  /**
   * Applique un thème
   * @param {string} theme - 'dark' ou 'light'
   */
  applyTheme(theme) {
    if (!Object.keys(this.themes).includes(theme)) {
      console.warn(`⚠️ Theme "${theme}" not found, using dark`);
      theme = 'dark';
    }

    this.currentTheme = theme;

    // Appliquer les variables CSS
    const themeVars = this.themes[theme];
    Object.entries(themeVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    // Appliquer la classe HTML
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }

    localStorage.setItem('aet_theme', theme);
    this.updateThemeIcon();

    console.log(`🎨 Theme applied: ${theme}`);
    this.trackEvent('theme_changed', { theme });
  }

  /**
   * Bascule entre les thèmes
   */
  toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  /**
   * Met à jour l'icône du toggle de thème
   */
  updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      const icon = this.currentTheme === 'dark' ? 'sun' : 'moon';
      btn.innerHTML = `<i class="fas fa-${icon}"></i>`;
      btn.setAttribute('aria-label', `Changer au thème ${this.currentTheme === 'dark' ? 'clair' : 'sombre'}`);
    }
  }

  /**
   * Crée le bouton toggle de thème
   */
  createThemeToggle() {
    const header = document.querySelector('.navbar-header');
    if (!header || document.getElementById('themeToggle')) return;

    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', 'Changer le thème');
    btn.onclick = () => this.toggle();
    
    header.appendChild(btn);
    this.updateThemeIcon();
    
    console.log('✨ Theme toggle button created');
  }

  /**
   * Setup la préférence système
   */
  setupSystemPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    prefersDark.addEventListener('change', (e) => {
      const savedTheme = localStorage.getItem('aet_theme');
      if (!savedTheme) {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Appliquer au démarrage si pas de thème sauvegardé
    if (!localStorage.getItem('aet_theme')) {
      const theme = prefersDark.matches ? 'dark' : 'light';
      this.applyTheme(theme);
    }
  }

  /**
   * Enregistre un thème personnalisé
   * @param {string} name - Nom du thème
   * @param {object} colors - Couleurs du thème
   */
  registerCustomTheme(name, colors) {
    this.themes[name] = colors;
    console.log(`✨ Custom theme registered: ${name}`);
  }

  /**
   * Applique un thème personnalisé
   * @param {string} name - Nom du thème
   */
  applyCustomTheme(name) {
    if (!this.themes[name]) {
      console.error(`❌ Custom theme "${name}" not found`);
      return;
    }
    this.applyTheme(name);
  }

  /**
   * Obtient le thème actuel
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Obtient tous les thèmes
   */
  getAvailableThemes() {
    return Object.keys(this.themes);
  }

  /**
   * Suivi des événements (analytics)
   * @param {string} eventName - Nom de l'événement
   * @param {object} data - Données additionnelles
   */
  trackEvent(eventName, data = {}) {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, data);
    }
    console.log(`📊 Event tracked: ${eventName}`, data);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
