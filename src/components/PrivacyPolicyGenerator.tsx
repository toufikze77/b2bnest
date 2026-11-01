import LegalDocumentGenerator from '@/components/legal/LegalDocumentGenerator';

/** Phase 30: AI-drafted UK privacy policies and legal notices (generate-legal-document, 2 AI credits each). */
const PrivacyPolicyGenerator = () => (
  <LegalDocumentGenerator
    kind="legal_notice"
    title="Privacy & Legal Notices Generator"
    intro="Draft a privacy policy, cookie policy or other notice under UK GDPR and the Data Protection Act 2018. Tick what your business collects; anything you leave out is shown as a [placeholder]. Have a solicitor check it before you rely on it."
  />
);

export default PrivacyPolicyGenerator;
