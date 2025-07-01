
import VideoTutorialSection from './VideoTutorialSection';
import EarlyInvestorBenefits from './EarlyInvestorBenefits';

const HowToInvestSection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <VideoTutorialSection />
      <EarlyInvestorBenefits />
    </div>
  );
};

export default HowToInvestSection;
