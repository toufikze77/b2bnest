
import { TemplateLicense } from '@/types/template';

export const templateLicenses: TemplateLicense[] = [
  {
    type: 'Free',
    name: 'Creative Commons',
    description: 'Free for personal and commercial use with attribution',
    personalUse: true,
    commercialUse: true,
    resaleRights: false,
    modificationRights: true,
    distributionRights: true,
    creditsRequired: true
  },
  {
    type: 'Premium',
    name: 'Royalty-Free License',
    description: 'Full commercial rights without attribution required',
    personalUse: true,
    commercialUse: true,
    resaleRights: false,
    modificationRights: true,
    distributionRights: false,
    creditsRequired: false
  },
  {
    type: 'Enterprise',
    name: 'Extended Commercial License',
    description: 'Full rights including resale and distribution',
    personalUse: true,
    commercialUse: true,
    resaleRights: true,
    modificationRights: true,
    distributionRights: true,
    creditsRequired: false
  }
];
