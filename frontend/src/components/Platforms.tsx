import { Card, CardContent, Badge } from './ui';
import { Check, ExternalLink, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  PLATFORMS,
  PLATFORM_CATEGORIES,
  SUPPORT_LABELS,
  SUPPORT_DESCRIPTIONS,
  platformIconUrl,
  type SupportLevel,
} from '../lib/platforms';

const statusStyles: Record<
  SupportLevel,
  { variant: 'success' | 'warning' | 'error' | 'default'; Icon: typeof Check }
> = {
  working: { variant: 'success', Icon: Check },
  limited: { variant: 'warning', Icon: AlertCircle },
  degraded: { variant: 'warning', Icon: Info },
  blocked: { variant: 'error', Icon: ShieldAlert },
};

export function Platforms() {
  const working = PLATFORMS.filter((p) => p.support === 'working').length;

  return (
    <section id="platforms" className="py-20 lg:py-32 scroll-mt-20" aria-labelledby="platforms-heading">
      <div className="section-container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="platforms-heading" className="heading-lg gradient-text mb-4">
            Supported platforms
          </h2>
          <p className="body-lg text-dark-400">
            {working} of {PLATFORMS.length} integrations are verified working end to end. We list the
            rest honestly rather than pretending, and we update this as the upstream services change.
          </p>
        </div>

        {/* Status legend */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-14 max-w-4xl mx-auto">
          {(Object.keys(SUPPORT_LABELS) as SupportLevel[]).map((level) => (
            <div
              key={level}
              className="flex items-start gap-3 p-4 rounded-xl bg-dark-900/40 border border-dark-800/60"
            >
              <span
                className={cn(
                  'mt-0.5 h-2.5 w-2.5 rounded-full shrink-0',
                  level === 'working' && 'bg-green-400',
                  level === 'limited' && 'bg-amber-400',
                  level === 'degraded' && 'bg-orange-400',
                  level === 'blocked' && 'bg-red-400'
                )}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-dark-200">{SUPPORT_LABELS[level]}</p>
                <p className="text-xs text-dark-500 leading-relaxed mt-0.5">
                  {SUPPORT_DESCRIPTIONS[level]}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-12">
          {PLATFORM_CATEGORIES.map((category, catIndex) => {
            const items = PLATFORMS.filter((p) => p.category === category);
            if (items.length === 0) return null;

            return (
              <div
                key={category}
                className="animate-slide-up"
                style={{ animationDelay: `${catIndex * 100}ms` }}
              >
                <h3 className="heading-sm mb-6 flex items-center gap-3">
                  <span className="px-3 py-1 bg-flux-500/10 text-flux-400 rounded-full text-sm font-medium">
                    {category}
                  </span>
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((platform, pIndex) => {
                    const config = statusStyles[platform.support];
                    const { Icon } = config;

                    return (
                      <Card
                        key={`${platform.id}-${pIndex}`}
                        className={cn(
                          'group p-4 transition-colors',
                          platform.support === 'blocked'
                            ? 'opacity-60 hover:opacity-90'
                            : 'hover:border-flux-500/30'
                        )}
                        style={{ animationDelay: `${pIndex * 30}ms` }}
                      >
                        <CardContent className="p-0">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-white/95 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm ring-1 ring-black/10 group-hover:ring-flux-500/30 transition-all">
                              <img
                                src={platformIconUrl(platform)}
                                alt={`${platform.name} logo`}
                                width={28}
                                height={28}
                                loading="lazy"
                                decoding="async"
                                className="w-7 h-7 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="font-medium text-dark-100 truncate">{platform.name}</h4>
                                {platform.adult && (
                                  <Badge variant="error" size="sm" className="shrink-0">
                                    18+
                                  </Badge>
                                )}
                                <Badge variant={config.variant} size="sm">
                                  <Icon className="h-3 w-3" aria-hidden="true" />
                                  {SUPPORT_LABELS[platform.support]}
                                </Badge>
                              </div>

                              {platform.support === 'working' ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {platform.outputs.map((output) => (
                                    <Badge key={output} variant="default" size="sm" className="text-xs">
                                      {output}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-dark-500 leading-relaxed">
                                  {platform.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-8 p-6 card gradient-border text-center">
            <h3 className="heading-sm mb-2">Missing a platform?</h3>
            <p className="body-md mb-4 max-w-md mx-auto">
              We are constantly adding new integrations. Request support for your favourite platform.
            </p>
            <a
              href="mailto:support@getsocials.app?subject=Platform%20request"
              className="link inline-flex items-center gap-2"
            >
              Request a platform
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
