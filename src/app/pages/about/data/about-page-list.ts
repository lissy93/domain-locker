export interface AboutLink {
  title: string;
  description: string;
  link?: string;
  href?: string;
  icon: string;
  index?: number;
}

export interface AboutPage {
  title: string;
  description?: string;
  dirSlug?: string;
  svgIcon?: string;
  links: AboutLink[];
}

export const aboutPages: AboutPage[] = [
  {
    title: 'Intro',
    svgIcon: 'intro',
    description: 'Welcome to Domain Locker, the domain management system for everyone',
    links: [
      {
        title: 'Why?',
        description:
          'Discover why Domain Locker exists, and why you need a domain management system',
        link: '/about/domain-management',
        icon: '',
      },
      {
        title: 'Features',
        description:
          'Domain Locker is packed full of features, discover what it can do for you',
        link: '/about/features',
        icon: '',
      },
      {
        title: 'Pricing',
        description:
          "Getting started is free, if you need to scale up, we've got an affordable plan for you",
        link: '/about/pricing',
        icon: '',
      },
      {
        title: 'Comparison',
        description:
          'Compare alternatives to Domain Locker, to find the right solution for you',
        link: '/about/alternatives',
        icon: '',
      },
      {
        title: 'Self-Hosting',
        description: 'Domain Locker is open source, and can be self-hosted with Docker',
        link: '/about/self-hosting',
        icon: 'pi pi-server',
      },
      {
        title: 'Live Demo',
        description: 'Try Domain Locker live, before you signup/self-host',
        link: '/about/demo',
        icon: 'pi pi-desktop',
      },
    ],
  },
  {
    title: 'Guides',
    svgIcon: 'guides',
    dirSlug: 'guides',
    description:
      'Get started with Domain Locker, and learn how to use it to manage your domains',
    links: [],
  },
  {
    title: 'Articles',
    svgIcon: 'articles',
    dirSlug: 'articles',
    description: 'In-depth articles to help you get the most out of Domain Locker',
    links: [
      {
        title: 'Useful tools and resources',
        description:
          'Free and/or open source tools, utils and services for managing domains',
        link: '/about/external-tools',
        icon: '',
      },
    ],
  },
  {
    title: 'Community',
    description: 'Domain Locker is built by the community, for the community',
    svgIcon: 'community',
    links: [
      {
        title: 'Attributions',
        description: 'Shout outs to everyone whose made Domain Locker possible',
        link: '/about/attributions',
        icon: 'pi pi-heart',
      },
      {
        title: 'Support Domain Locker',
        description: 'Ways you can help us out',
        href: 'https://github.com/sponsors/Lissy93',
        icon: 'pi pi-heart',
      },
      {
        title: 'Contributing',
        description: "Contributing guidelines for Domain Locker's open source code",
        link: '/about/developing',
        icon: '',
      },
    ],
  },
  {
    title: 'Support',
    svgIcon: 'support',
    description: "We're here to help you get the most out of Domain Locker",
    links: [
      {
        title: 'How-Tos',
        description: 'Short guides to help you mae the most of Domain Locker',
        link: '/about',
        icon: '',
      },
      {
        title: 'FaQ',
        description: 'Answers to commonly asked questions',
        link: '/about/support/faq',
        icon: 'pi pi-question-circle',
      },
      {
        title: 'Contact',
        description: 'Get in touch or raise a support ticket',
        link: '/about/support/contact',
        icon: '',
      },
      {
        title: 'Self-Hosted Support',
        description: 'Resolving issues with a self-hosted instance',
        link: '/about/support/self-hosted-support',
        icon: '',
      },
    ],
  },
  {
    title: 'Legal',
    dirSlug: 'legal',
    svgIcon: 'legal',
    description: 'The legal stuff you need to know about using Domain Locker',
    links: [
      // These pages are auto-populated from the /src/content/docs/legal/*.md files
      // Files include: accessibility, community-guidelines, cookies, gdpr-statement,
      // license, privacy-policy, security and terms-of-service
    ],
  },
  {
    title: 'Developing',
    dirSlug: 'developing',
    svgIcon: 'developing',
    description: 'Resources for developers who want to contribute to Domain Locker',
    links: [], // Auto-populated from /src/content/docs/developing/*.md files
  },
  {
    title: 'Self-Hosting',
    dirSlug: 'self-hosting',
    svgIcon: 'selfHosting',
    description: 'Instructions for running Domain Locker on your own system or server',
    links: [
      {
        title: 'Quick Start',
        description: 'Get up and running in minutes',
        link: '/about/self-hosting',
        icon: '',
      },
    ], // Auto-populated from /src/content/docs/self-hosting/*.md files
  },
  {
    title: 'External Links',
    svgIcon: 'externalLinks',
    description: 'Other stuff, like our source code, download links and more resources',
    links: [
      {
        title: 'GitHub',
        description: 'Domain Locker source code',
        href: 'https://github.com/lissy93/domain-locker',
        icon: 'pi pi-github',
      },
      {
        title: 'DockerHub',
        description: 'Docker container for self-hosting',
        href: 'https://hub.docker.com/r/lissy93/domain-locker',
        icon: '',
      },
      {
        title: 'Useful Domain Tools',
        description: 'More free & open source tools for domain management',
        link: '/about/external-tools',
        icon: 'pi pi-external-link',
      },
      {
        title: 'AS93 Apps',
        description: 'More apps developed by the creator of Domain Locker',
        href: 'https://apps.aliciasykes.com',
        icon: '',
      },
    ],
  },
];
