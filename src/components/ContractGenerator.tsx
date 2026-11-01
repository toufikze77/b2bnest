import LegalDocumentGenerator from '@/components/legal/LegalDocumentGenerator';

/** Phase 30: AI-drafted UK contracts (generate-legal-document, 2 AI credits each). */
const ContractGenerator = () => (
  <LegalDocumentGenerator
    kind="contract"
    title="Contract Generator"
    intro="Choose a contract, fill in what you know and the AI drafts it under UK law. Anything you leave out is shown as a [placeholder] to fill in. Have a solicitor check it before you rely on it."
  />
);

export default ContractGenerator;
