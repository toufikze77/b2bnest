import { useNavigate } from "react-router-dom";
import ShareButton from "./ShareButton";

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <span className="text-xl font-bold">B2BNEST</span>
              <p className="text-sm text-gray-400 mt-1">A brand of Edeals Master Ltd</p>
            </div>
            <p className="text-gray-400">
              Professional business forms and documents for modern companies.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Pages</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <button 
                  onClick={() => navigate('/business-social')}
                  className="hover:text-white transition-colors"
                >
                  BizzLink
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/business-tools')}
                  className="hover:text-white transition-colors"
                >
                  Business Tools
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/ai-studio')}
                  className="hover:text-white transition-colors"
                >
                  AI Studio
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/pricing')}
                  className="hover:text-white transition-colors"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Help Center</li>
              <li>Contact Us</li>
              <li>FAQs</li>
              <li>Live Chat</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <button 
                  onClick={() => navigate('/about')}
                  className="hover:text-white transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/privacy')}
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/terms')}
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/blog')}
                  className="hover:text-white transition-colors"
                >
                  Blog
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Share B2BNEST:</span>
              <ShareButton variant="outline" size="sm" />
            </div>
          </div>
          <div className="text-center text-gray-400">
            <p>&copy; 2024 Edeals Master Ltd (Company No. 15242148) trading as B2BNEST. All rights reserved.</p>
            <p className="text-sm mt-2">Incorporated in England & Wales on 27 October 2023</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
