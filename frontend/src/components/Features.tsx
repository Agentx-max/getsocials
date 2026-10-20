import { Card, CardContent } from './ui';
import {
  Zap,
  Shield,
  Globe,
  Download,
  Eye,
  Layers,
  Clock,
  Wifi,
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized extraction engine delivers media info in seconds, not minutes.',
    gradient: 'from-flux-500 to-flux-600',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'No accounts, no tracking, no logs. Your downloads stay private.',
    gradient: 'from-electric-500 to-electric-600',
  },
  {
    icon: Globe,
    title: 'Universal Support',
    description: '20+ platforms supported with more added regularly. One tool for everything.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Download,
    title: 'Multiple Formats',
    description: 'Choose quality and format. Video, audio, or images — your choice.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: Eye,
    title: 'Instant Preview',
    description: 'See thumbnails, duration, and available formats before downloading.',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    icon: Layers,
    title: 'Clean Interface',
    description: 'Beautiful, distraction-free UI that works on any device.',
    gradient: 'from-indigo-500 to-purple-500',
  },
  {
    icon: Clock,
    title: 'No Rate Limits',
    description: 'Generous limits for personal use. Download what you need.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Wifi,
    title: 'Works Offline',
    description: 'Downloaded media plays anywhere — no internet required.',
    gradient: 'from-amber-500 to-orange-500',
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-32 bg-dark-900/30 scroll-mt-20" aria-labelledby="features-heading">
      <div className="section-container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="features-heading" className="heading-lg gradient-text mb-4">
            Built for modern media workflows
          </h2>
          <p className="body-lg text-dark-400">
            Every feature designed to make downloading media as effortless as possible.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="group animate-slide-up"
              padding="none"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4 sm:p-6 h-full flex flex-col">
                <div
                  className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: feature.gradient }}
                >
                  <feature.icon className="h-4 w-4 sm:h-6 sm:w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-base sm:text-xl font-heading font-semibold tracking-tight text-dark-100 mb-1.5 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-dark-400 flex-1">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}