
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TermsOfService = () => {
  const sections = [
    {
      title: "Acceptance of Terms",
      content: "By accessing and using B2BNEST, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."
    },
    {
      title: "Use License",
      content: "Permission is granted to temporarily access and use B2BNEST for personal and commercial purposes. This license does not include: modifying or copying the materials, using the materials for commercial purpose without proper licensing, or attempting to reverse engineer any software contained on the platform."
    },
    {
      title: "User Accounts",
      content: "When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account."
    },
    {
      title: "Prohibited Uses",
      content: "You may not use our service: for any unlawful purpose or to solicit others to engage in unlawful acts, to violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances, to infringe upon or violate our intellectual property rights or the intellectual property rights of others, to harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate, or to submit false or misleading information."
    },
    {
      title: "Content",
      content: "Our service allows you to create, post, and share content. You are responsible for the content that you post to the service, including its legality, reliability, and appropriateness. By posting content to the service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such content on and through the service."
    },
    {
      title: "Privacy Policy",
      content: "Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information when you use our service. By using our service, you agree to the collection and use of information in accordance with our Privacy Policy."
    },
    {
      title: "Intellectual Property",
      content: "The service and its original content, features, and functionality are and will remain the exclusive property of B2BNest and its licensors. The service is protected by copyright, trademark, and other laws. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent."
    },
    {
      title: "Termination",
      content: "We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the service will cease immediately."
    },
    {
      title: "Limitation of Liability",
      content: "In no event shall B2BNest, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the service."
    },
    {
      title: "Changes to Terms",
      content: "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-lg text-gray-600">
            Last updated: June 14, 2025
          </p>
        </div>

        <Card className="bg-white shadow-lg mb-8">
          <CardContent className="p-8">
            <p className="text-lg text-gray-700 mb-6">
              These Terms of Service ("Terms") govern your use of the B2BNEST platform and services operated by Edeals Master Ltd (Company No. 15242148). 
              Please read these Terms carefully before using our service.
            </p>
            <p className="text-gray-700">
              By accessing or using B2BNEST, you agree to be bound by these Terms and our Privacy Policy.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <Card key={index} className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-900">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{section.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-blue-50 shadow-lg mt-8">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-900">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Edeals Master Ltd</strong> (Company No. 15242148) trading as B2BNEST</p>
              <p>Incorporated in England & Wales on 27 October 2023</p>
              <p>Email: legal@b2bnest.com</p>
              <p>Address: 1 St Katharine's Way, London E1W 1UN</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
