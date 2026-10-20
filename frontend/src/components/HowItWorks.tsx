import { Badge } from './ui';
import { ArrowRight, Copy, Search, Download, Check } from 'lucide-react';
import { cn } from '../lib/utils';

const steps = [
  {
    number: '01',
    title: 'Paste your URL',
    description:
      'Copy any media link from TikTok, YouTube, Instagram, Twitter, or 15+ other platforms and paste it into the box above.',
    points: ['Video, audio, image and gallery posts', 'Share links and direct URLs', 'Automatic platform detection'],
    icon: Copy,
  },
  {
    number: '02',
    title: 'We find every format',
    description:
      'Our engine reads the post and lists every available quality — with real file sizes, not guesses.',
    points: ['Up to 4K video', 'Separate audio tracks', 'Thumbnails and duration'],
    icon: Search,
  },
  {
    number: '03',
    title: 'Download instantly',
    description:
      'Pick the quality you want and save it straight to your device. No redirects, no watermarks, no sign-up.',
    points: ['One-click download', 'Real progress indicator', 'No account required'],
    icon: Download,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-32 bg-dark-900/30 scroll-mt-20" aria-labelledby="how-it-works-heading">
      <div className="section-container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="how-it-works-heading" className="heading-lg gradient-text mb-4">
            How it works
          </h2>
          <p className="body-lg text-dark-400">
            Three simple steps to get your media. No complexity, no waiting.
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-10 sm:space-y-14">
          {steps.map((step, index) => {
            const isReversed = index % 2 === 1;
            const Icon = step.icon;

            return (
              <div
                key={step.number}
                className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12 animate-slide-up"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                {/* Text column */}
                <div className={cn('min-w-0', isReversed && 'lg:order-2')}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-flux-500 to-flux-600 text-white text-sm font-bold shrink-0">
                      {step.number}
                    </span>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-flux-500/12 text-flux-400 shrink-0">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  <h3 className="heading-sm mb-3">{step.title}</h3>
                  <p className="body-md mb-5">{step.description}</p>

                  <ul className="space-y-2.5">
                    {step.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm text-dark-400">
                        <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual column */}
                <div className={cn('min-w-0', isReversed && 'lg:order-1')}>
                  <StepVisual step={index} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * A small mock of the interface, so the section shows what actually happens.
 */
function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="rounded-2xl border border-dark-700/70 bg-dark-900/60 p-4 sm:p-5">
        <div className="flex items-center gap-2 rounded-xl bg-dark-800/70 border border-dark-700 px-3 py-3">
          <span className="h-4 w-4 rounded-full bg-dark-600 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left text-sm text-dark-400 truncate">
            https://www.tiktok.com/@user/video/7241…
          </span>
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-flux-500/15 text-flux-400 shrink-0">
            <Copy className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" size="sm">TikTok</Badge>
            <Badge variant="default" size="sm">YouTube</Badge>
            <Badge variant="default" size="sm">Instagram</Badge>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-flux-500 px-3 py-2 text-xs font-medium text-white shrink-0">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </span>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="rounded-2xl border border-dark-700/70 bg-dark-900/60 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-dark-200 truncate">Your video title</p>
            <p className="text-xs text-dark-500 mt-0.5">0:15 · TikTok</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {[
            { q: '1080p', m: '24.1 MB', w: 'w-full' },
            { q: '720p', m: '11.3 MB', w: 'w-3/4' },
            { q: '480p', m: '6.8 MB', w: 'w-1/2' },
          ].map((row) => (
            <div
              key={row.q}
              className="flex items-center gap-3 rounded-lg bg-dark-800/50 border border-dark-700/60 px-3 py-2"
            >
              <span className="text-xs font-medium text-dark-300 w-12 shrink-0">{row.q}</span>
              <span className="h-1.5 rounded-full bg-flux-500/50 shrink-0" style={{ width: row.w === 'w-full' ? '45%' : row.w === 'w-3/4' ? '32%' : '20%' }} />
              <span className="text-xs text-dark-500 ml-auto shrink-0">{row.m}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dark-700/70 bg-dark-900/60 p-4 sm:p-5">
      <div className="rounded-xl bg-dark-800/60 border border-dark-700 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-dark-400">1080p · MP4</span>
          <span className="text-xs text-dark-500">24.1 MB</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-dark-700 overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-flux-500 to-electric-500" />
        </div>
        <p className="mt-2 text-right text-[11px] text-flux-400">75%</p>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-green-500/15 text-green-400 shrink-0">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-xs text-dark-400">
          Saved to your device
          <span className="flex items-center gap-1 text-dark-600 mt-0.5">
            Your-video-1080p - getsocials.com.mp4
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </p>
      </div>
    </div>
  );
}
