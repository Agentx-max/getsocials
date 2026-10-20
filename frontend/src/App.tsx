import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Platforms } from './components/Platforms';
import { HowItWorks } from './components/HowItWorks';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { UrlPanel } from './components/UrlPanel';

/**
 * Scrolls to a hash target after a route change (e.g. arriving from
 * /download via a "#features" link). Uses a small delay so the target
 * section is mounted before we try to scroll to it.
 */
function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { scrollTo?: string } | null;
    const hash = state?.scrollTo || (location.hash ? location.hash.slice(1) : '');

    if (!hash) return;

    const timer = window.setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `#${hash}`);
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash, location.state]);

  return null;
}

function LandingPage() {
  return (
    <>
      <Navigation />
      <main id="main-content" role="main">
        <Hero />
        <Features />
        <Platforms />
        <HowItWorks />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

function DownloadPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 flex items-center justify-center py-28 lg:py-32 px-4" id="main-content">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="heading-lg gradient-text mb-4">Download Media</h1>
            <p className="body-lg text-dark-400">
              Paste a URL from any supported platform to get started.
            </p>
          </div>
          <UrlPanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function LegalPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 py-28 lg:py-32 px-4" id="main-content">
        <div className="max-w-3xl mx-auto">
          <h1 className="heading-lg gradient-text mb-8">{title}</h1>
          <div className="prose max-w-none text-dark-400 space-y-6">
            <p>
              This is a placeholder for the {title.toLowerCase()}. In a production deployment, this page
              would contain the full legal text. For now, please contact
              <a href="mailto:support@getsocials.app" className="link">
                support@getsocials.app
              </a>{' '}
              for licensing and usage information.
            </p>
            <p>
              GETSocials is built on top of the universalDownloader API by Milan Bhandari. The original project
              is licensed under the MIT License.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <ScrollManager />
        <div className="min-h-screen bg-dark-950">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/privacy" element={<LegalPage title="Privacy Policy" />} />
            <Route path="/terms" element={<LegalPage title="Terms of Service" />} />
            <Route path="/dmca" element={<LegalPage title="DMCA Policy" />} />
            <Route path="/fair-use" element={<LegalPage title="Fair Use Policy" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
