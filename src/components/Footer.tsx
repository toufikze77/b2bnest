import { useNavigate } from "react-router-dom";
import ShareButton from "./ShareButton";
import { useAuth } from "@/hooks/useAuth";

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const allowedMarketingEmails = ["toufikze@gmail.com", "toufik.zemri@outlook.com"];
  const canSeeMarketing = user?.email && allowedMarketingEmails.includes(user.email);

  return (
    <footer className="bg-card border-t border-border text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <span className="text-xl font-bold">B2BNEST</span>
              <p className="text-sm text-muted-foreground mt-1">A brand of Edeals Master Ltd</p>
            </div>
            <p className="text-muted-foreground">
              AI-powered business tools and automation for modern companies.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Pages</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <button 
                  onClick={() => navigate('/business-tools')}
                  className="hover:text-foreground transition-colors"
                >
                  Business Tools
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/ai-studio')}
                  className="hover:text-foreground transition-colors"
                >
                  AI Studio
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/pricing')}
                  className="hover:text-foreground transition-colors"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <button 
                  onClick={() => navigate('/help')}
                  className="hover:text-foreground transition-colors"
                >
                  Help Center
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/contact')}
                  className="hover:text-foreground transition-colors"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/knowledge-base')}
                  className="hover:text-foreground transition-colors"
                >
                  Knowledge Base
                </button>
              </li>
              <li>
                <button 
                  onClick={() => window.open('https://tawk.to/chat/b2bnest', '_blank')}
                  className="hover:text-foreground transition-colors"
                >
                  Live Chat
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <button 
                  onClick={() => navigate('/about')}
                  className="hover:text-foreground transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/privacy')}
                  className="hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/terms')}
                  className="hover:text-foreground transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigate('/blog')}
                  className="hover:text-foreground transition-colors"
                >
                  Blog
                </button>
              </li>
              {canSeeMarketing && (
                <li>
                  <button 
                    onClick={() => navigate('/marketing-materials')}
                    className="hover:text-foreground transition-colors"
                  >
                    Marketing Materials
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Share B2BNEST:</span>
              <ShareButton variant="outline" size="sm" />
            </div>
          </div>
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Edeals Master Ltd (Company No. 15242148) trading as B2BNEST. All rights reserved.</p>
            <p className="text-sm mt-2">Incorporated in England & Wales on 27 October 2023</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
