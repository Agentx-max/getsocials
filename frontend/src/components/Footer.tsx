import { Link } from 'react-router-dom';
import { HashLink } from './ui/HashLink';
import { Heart, Sparkles, Mail } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Platforms', href: '#platforms' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'FAQ', href: '#faq' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'DMCA', href: '/dmca' },
    { label: 'Fair Use', href: '/fair-use' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-dark-800 bg-dark-950/50" role="contentinfo">
      <div className="section-container py-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1 xl:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-6" aria-label="GETSocials Home">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-flux-500 to-flux-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <span className="text-xl font-heading font-bold text-dark-50">GETSocials</span>
            </Link>
            <p className="body-md text-dark-400 max-w-sm mb-6">
              Your media. One simple workflow. Download from 20+ platforms instantly — no accounts, no
              watermarks, no tracking.
            </p>
            <a
              href="mailto:support@getsocials.app"
              className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-flux-400 transition-colors"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              support@getsocials.app
            </a>
          </div>

          {/* Product links */}
          <nav aria-label="Product">
            <h3 className="font-medium text-dark-100 mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <HashLink
                    hash={link.href.slice(1)}
                    className="text-dark-400 hover:text-flux-400 transition-colors text-sm"
                  >
                    {link.label}
                  </HashLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal links */}
          <nav aria-label="Legal">
            <h3 className="font-medium text-dark-100 mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-dark-400 hover:text-flux-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company links */}
          <nav aria-label="Company">
            <h3 className="font-medium text-dark-100 mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-dark-400 hover:text-flux-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-dark-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-dark-500 text-center sm:text-left">
            © {currentYear} GETSocials. Built with{' '}
            <Heart className="h-3.5 w-3.5 text-red-500 inline-block align-middle" aria-hidden="true" />
            {' '}by Agent X | TechKey Team.
          </p>
          <p className="text-sm text-dark-500 text-center sm:text-right">
            For media you own or are authorized to save.
          </p>
        </div>
      </div>
    </footer>
  );
}
