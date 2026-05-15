interface SupportInfo {
  title: string;
  intro: string[];
  links: {
    title: string;
    routerLink?: string;
    href?: string;
    description: string;
    icon: string;
  }[];
}

export const hostedSupport: SupportInfo = {
  title: 'Domain-Locker.com Support',
  intro: [
    'We offer support to all users on the Pro plan or above.' +
      'As well as some assistance with issues, data requests and security' +
      'queries to all other users.',
    'Where possible, we aim to resolve issues within a few hours, depending on' +
      'severity and complexity.' +
      'You will receive a (human!) response within 2 working days of submitting any a ticket.',
  ],
  links: [
    {
      title: 'Submit a ticket',
      routerLink: '/about/support/contact',
      description: 'Get 1 on 1 help from our support team',
      icon: '',
    },
    // {
    //   title: 'Frequently Asked Questions',
    //   routerLink: '/about/support/faq',
    //   description: 'Common questions, and quick solutions',
    //   icon: '',
    // },
    {
      title: 'Guides',
      routerLink: '/about/guides',
      description:
        'Tutorials on getting started with Domain Locker, and what everything means',
      icon: '',
    },
  ],
};

export const selfHostedSupport: SupportInfo = {
  title: 'Support for Self-Hosted Instances',
  intro: [
    'Please note, that we are unable to guarantee support for those running a self-hosted ' +
      'instance of Domain Locker on their own infrastructure at this time. ' +
      'But we have got comprehensive docs and resources which should cover ' +
      'any issues you might be facing. ',
    'If that fails, enable debug mode to determine where and why the issue occurs. ' +
      'You will then be able to locate the source of the problem in the code, ' +
      'and apply any fixes or mitigations to resolve your bug.',
  ],
  links: [
    {
      title: 'Developing Documentation',
      routerLink: '/about/developing',
      description: 'Guides covering everything you need to know about the code source',
      icon: '',
    },
    {
      title: 'Resolving a Bug',
      routerLink: '/about/developing/debugging',
      description: 'Step-by-step debugging for common issues',
      icon: '',
    },
    {
      title: 'Source Code',
      href: 'https://github.com/lissy93/domain-locker',
      description:
        'All you need is the code, and you can fix anything, View it on GitHub',
      icon: '',
    },
    {
      title: 'Third-Party Docs',
      routerLink: '/about/developing/third-party-docs',
      description: 'Links to help and support for third-party providers',
      icon: '',
    },
  ],
};

export const supportContent: SupportInfo[] = [hostedSupport, selfHostedSupport];
