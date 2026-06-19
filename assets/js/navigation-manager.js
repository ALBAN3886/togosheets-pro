/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧭 NAVIGATION MANAGER - Gestionnaire de Navigation Moderne
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class NavigationManager {
  constructor() {
    this.navbarCollapsed = localStorage.getItem('aet_nav_collapsed') === '1';
    this.activeTab = localStorage.getItem('aet_active_tab') || 'dashboard';
    this.mobileBreakpoint = 768;
    this.init();
  }

  /**
   * Initialise le gestionnaire de navigation
   */
  init() {
    this.restoreState();
    this.attachEventListeners();
    this.setupDropdowns();
    this.lazyLoadContent();
    console.log('✅ NavigationManager initialized');
  }

  /**
   * Restaure l'état sauvegardé
   */
  restoreState() {
    if (this.navbarCollapsed) {
      document.body.classList.add('nav-collapsed');
    }
  }

  /**
   * Bascule le collapse de la sidebar
   */
  toggleSidebarCollapse() {
    this.navbarCollapsed = !this.navbarCollapsed;
    document.body.classList.toggle('nav-collapsed', this.navbarCollapsed);
    localStorage.setItem('aet_nav_collapsed', this.navbarCollapsed ? '1' : '0');
    
    const navbar = document.querySelector('.navbar-modern');
    if (navbar) {
      navbar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    // Log pour analytics
    console.log('🔄 Sidebar collapse toggled:', this.navbarCollapsed);
    this.trackEvent('sidebar_toggle', { state: this.navbarCollapsed ? 'collapsed' : 'expanded' });
  }

  /**
   * Bascule la navbar mobile
   */
  toggleNavbar() {
    const navbar = document.getElementById('modernNavbar');
    const overlay = document.getElementById('navOverlay');
    const isActive = navbar?.classList.contains('active');
    
    if (navbar) navbar.classList.toggle('active', !isActive);
    if (overlay) overlay.classList.toggle('active', !isActive);
    
    document.body.style.overflow = !isActive ? 'hidden' : 'auto';
    console.log('📱 Navbar toggled:', !isActive ? 'open' : 'closed');
  }

  /**
   * Ferme la navbar mobile
   */
  closeNavbar() {
    const navbar = document.getElementById('modernNavbar');
    const overlay = document.getElementById('navOverlay');
    
    if (navbar) navbar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    document.body.style.overflow = 'auto';
  }

  /**
   * Attache les event listeners
   */
  attachEventListeners() {
    // Fermer la navbar au clic sur un item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= this.mobileBreakpoint) {
          this.closeNavbar();
        }
      });
    });

    // Fermer au clic sur l'overlay
    document.getElementById('navOverlay')?.addEventListener('click', () => this.closeNavbar());

    // Fermer au clic en dehors (desktop)
    if (window.innerWidth > this.mobileBreakpoint) {
      document.addEventListener('click', (e) => {
        const navbar = document.getElementById('modernNavbar');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (navbar && !navbar.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
          this.closeNavbar();
        }
      });
    }

    // Recalculer au redimensionnement
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Configure les dropdowns
   */
  setupDropdowns() {
    document.querySelectorAll('.nav-dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const dropdown = toggle.closest('.nav-dropdown');
        if (dropdown) {
          dropdown.classList.toggle('expanded');
          const isExpanded = dropdown.classList.contains('expanded');
          console.log('📂 Dropdown:', isExpanded ? 'expanded' : 'collapsed');
        }
      });
    });
  }

  /**
   * Met à jour l'item de nav actif
   * @param {string} tabName - Nom du tab
   */
  updateActiveNavItem(tabName) {
    this.activeTab = tabName;
    localStorage.setItem('aet_active_tab', tabName);

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Trouver et activer le bon item
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
      const itemText = item.textContent.toLowerCase();
      const dataTab = item.getAttribute('data-tab');
      
      if (dataTab === tabName || itemText.includes(tabName.toLowerCase())) {
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    console.log('✨ Active nav item updated:', tabName);
  }

  /**
   * Lazy load du contenu principal
   */
  lazyLoadContent() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animation = 'fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    observer.observe(mainContent);
    console.log('⚡ Lazy load initialized');
  }

  /**
   * Gère le redimensionnement de la fenêtre
   */
  handleResize() {
    const width = window.innerWidth;
    
    if (width > this.mobileBreakpoint && document.getElementById('modernNavbar')?.classList.contains('active')) {
      this.closeNavbar();
    }
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

  /**
   * Obtient l'état actuel
   */
  getState() {
    return {
      navbarCollapsed: this.navbarCollapsed,
      activeTab: this.activeTab,
      isMobile: window.innerWidth <= this.mobileBreakpoint,
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationManager;
}
