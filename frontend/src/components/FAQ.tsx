import { useState } from 'react';
import { Card, CardContent } from './ui';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react';

const faqs = [
  {
    question: 'Is GETSocials free to use?',
    answer: 'Yes, GETSocials is completely free for personal use. There are no hidden fees, subscriptions, or premium tiers. We believe media downloading should be accessible to everyone.',
  },
  {
    question: 'Which platforms are supported?',
    answer: 'We support 20+ platforms including TikTok, YouTube, Instagram, Facebook, Twitter/X, Reddit, SoundCloud, Pinterest, LinkedIn, Threads, Snapchat, Tumblr, Dailymotion, CapCut, Douyin, Kuaishou, Terabox, Bluesky, and Spotify. See the Platforms section for details on format support per platform.',
  },
  {
    question: 'Do I need to create an account?',
    answer: 'No. GETSocials requires no registration, no login, and no personal information. Just paste a URL and download. We don\'t track users or store download history.',
  },
  {
    question: 'Are there any download limits?',
    answer: 'For personal use, limits are generous. We don\'t impose strict daily limits, but excessive automated usage may be throttled to ensure fair access for all users.',
  },
  {
    question: 'Can I download private or restricted content?',
    answer: 'No. GETSocials only works with publicly accessible media. Private accounts, age-restricted content, paywalled media, and content requiring login cannot be downloaded. This is by design — we respect creator privacy and platform terms.',
  },
  {
    question: 'Why did my download fail?',
    answer: 'Common reasons: the content was removed, made private, is geo-restricted, or the platform changed their system. Try again later or with a different URL. If issues persist, the platform may no longer be supported.',
  },
  {
    question: 'Are downloads watermarked?',
    answer: 'Never. GETSocials provides direct links to the original media files without any watermarks, branding, or quality degradation.',
  },
  {
    question: 'Is it legal to download media?',
    answer: 'Downloading media you own or have permission to save is generally legal for personal use. However, downloading copyrighted content without authorization may violate terms of service or copyright law. Always ensure you have the right to download and use the content.',
  },
  {
    question: 'Does GETSocials store my downloaded files?',
    answer: 'No. We never store your media files on our servers. Downloads stream directly from the source platform to your device. We only temporarily process URL metadata in memory.',
  },
  {
    question: 'Can I use GETSocials on mobile?',
    answer: 'Yes! GETSocials is fully responsive and works great on iOS Safari, Android Chrome, and all modern mobile browsers. The interface adapts to any screen size.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-32 scroll-mt-20" aria-labelledby="faq-heading">
      <div className="section-container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="faq-heading" className="heading-lg gradient-text mb-4">
            Frequently asked questions
          </h2>
          <p className="body-lg text-dark-400">
            Everything you need to know about using GETSocials.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <Card key={index} className="overflow-hidden">
              <button
                type="button"
                className="w-full p-6 flex items-center justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-flux-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="font-medium text-dark-100 text-lg pr-8">{faq.question}</span>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-800/50 flex items-center justify-center text-dark-400 transition-transform duration-200">
                  {openIndex === index ? (
                    <ChevronUp className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
              </button>
              <CardContent
                id={`faq-answer-${index}`}
                className={openIndex === index ? 'p-0 pb-6 animate-slide-down' : 'p-0 h-0 overflow-hidden'}
                role="region"
                aria-label={faq.question}
              >
                <p className="px-6 body-md text-dark-400">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="body-md text-dark-500 mb-4">
            Didn't find your answer?
          </p>
          <a
            href="mailto:support@getsocials.app"
            className="link inline-flex items-center gap-2"
          >
            Contact support
            <Mail className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}