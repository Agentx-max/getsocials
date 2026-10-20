import { useCallback } from 'react';
import { Button } from './ui';
import { UrlPanel } from './UrlPanel';
import { Download, Sparkles, Check, ShieldCheck } from 'lucide-react';

export function Hero() {
  const scrollToPanel = useCallback(() => {
    const el = document.getElementById('url-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const scrollToHowItWorks = useCallback(() => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
      {/* Background layers */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-flux-500/15 via-transparent to-electric-500/10"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg_width=%2260%22_height=%2260%22_viewBox=%220_0_60_60%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg_fill=%22none%22_fill-rule=%22evenodd%22%3E%3Cg_fill=%22%239C92AC%22_fill-opacity=%220.035%22%3E%3Cpath_d=%22M36_34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6_34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6_4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
        aria-hidden="true"
      />

      <div className="relative section-container">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-flux-500/10 border border-flux-500/20 text-flux-300 text-xs sm:text-sm font-medium mb-7 animate-fade-in">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>GETSocials — Your media. One simple workflow.</span>
          </div>

          <h1 className="heading-xl text-balance mb-6 animate-slide-up">
            <span className="gradient-text">Download media</span>
            <br />
            from <span className="text-electric-400">any platform</span> instantly
          </h1>

          <p className="body-lg text-dark-400 max-w-2xl mx-auto mb-8 animate-slide-up delay-200 text-balance">
            Paste a link, get your media. No accounts, no watermarks, no Ads.
            Supports TikTok, YouTube, Instagram, Twitter, and 15+ platforms.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up delay-300 mb-10">
            <Button variant="primary" size="lg" onClick={scrollToPanel} className="w-full sm:w-auto group">
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" aria-hidden="true" />
                Try Now
              </span>
            </Button>
            <Button variant="secondary" size="lg" onClick={scrollToHowItWorks} className="w-full sm:w-auto">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                How it works
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-dark-500 animate-fade-in delay-400">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
              <span>No registration required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
              <span>No watermarks</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400 shrink-0" aria-hidden="true" />
              <span>Privacy focused</span>
            </div>
          </div>
        </div>

        {/* Interactive URL panel — the visual focus of the page */}
        <div id="url-panel" className="mt-12 lg:mt-16 scroll-mt-24 animate-slide-up delay-400">
          <UrlPanel />
        </div>
      </div>
    </section>
  );
}
