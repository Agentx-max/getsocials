import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Sparkles, Menu, X, Mail } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '#features' },
  { label: 'Platforms', href: '#platforms' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const scrollToHash = useCallback((hash: string) => {
    const element = document.getElementById(hash);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Keep the URL in sync without triggering a router navigation
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, []);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setIsMobileMenuOpen(false);

      if (href === '/') {
        navigate('/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (!href.startsWith('#')) return;

      const hash = href.slice(1);

      if (location.pathname !== '/') {
        // Navigate home first, then scroll once the target is mounted
        navigate('/', { state: { scrollTo: hash } });
        return;
      }

      scrollToHash(hash);
    },
    [location.pathname, navigate, scrollToHash]
  );

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return false;
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        'bg-dark-950/85 backdrop-blur-xl border-b border-dark-800/60',
        isScrolled ? 'bg-dark-950/95 shadow-glass' : 'shadow-none'
      )}
      role="banner"
    >
      <nav className="section-container" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link
            to="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 flex-shrink-0"
            aria-label="GETSocials Home"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-flux-500 to-flux-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="hidden sm:block text-lg font-heading font-bold text-dark-50">GETSocials</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href === '/' ? '/' : `/#${item.href.slice(1)}`}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  'text-sm font-medium transition-colors relative',
                  isActive(item.href)
                    ? 'text-flux-400'
                    : 'text-dark-300 hover:text-flux-400'
                )}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800/50 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          id="mobile-menu"
          className={cn(
            'lg:hidden overflow-hidden transition-all duration-300 ease-expo',
            isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="py-4 space-y-2 border-t border-dark-800">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href === '/' ? '/' : `/#${item.href.slice(1)}`}
                onClick={(e) => handleNavClick(e, item.href)}
                className="block px-4 py-3 rounded-xl text-dark-300 hover:text-flux-400 hover:bg-dark-800/50 transition-colors font-medium"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 border-t border-dark-800">
              <a
                href="mailto:support@getsocials.app"
                className="block px-4 py-3 rounded-xl text-dark-300 hover:text-flux-400 hover:bg-dark-800/50 transition-colors font-medium flex items-center gap-2"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
                Contact support
              </a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
