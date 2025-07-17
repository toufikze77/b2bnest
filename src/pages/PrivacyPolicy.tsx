
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PrivacyPolicy = () => {
  const sections = [
    {
      title: "Information We Collect",
      content: [
        "Personal Information: When you create an account, we collect your name, email address, and contact information.",
        "Usage Data: We automatically collect information about how you use our platform, including pages visited and features used.",
        "Document Data: We may store templates and documents you create or modify on our platform.",
        "Communication Data: Records of your communications with our support team."
      ]
    },
    {
      title: "How We Use Your Information",
      content: [
        "Provide and maintain our services",
        "Process your transactions and send related information",
        "Send you technical notices, updates, and support messages",
        "Respond to your comments and questions",
        "Improve our services and develop new features",
        "Comply with legal obligations"
      ]
    },
    {
      title: "Information Sharing",
      content: [
        "We do not sell, trade, or rent your personal information to third parties.",
        "We may share information with service providers who assist in operating our platform.",
        "We may disclose information if required by law or to protect our rights.",
        "In case of a business transfer, user information may be transferred as part of the assets."
      ]
    },
    {
      title: "Data Security",
      content: [
        "We implement appropriate security measures to protect your information.",
        "All data transmission is encrypted using SSL technology.",
        "We regularly update our security practices and conduct security audits.",
        "Access to personal information is restricted to authorized personnel only."
      ]
    },
    {
      title: "Your Rights",
      content: [
        "Access: You can request a copy of your personal information.",
        "Correction: You can update or correct your personal information.",
        "Deletion: You can request deletion of your account and associated data.",
        "Portability: You can request a copy of your data in a portable format.",
        "Objection: You can object to certain processing of your information."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-lg text-gray-600">
            Last updated: June 14, 2025
          </p>
        </div>

        <Card className="bg-white shadow-lg mb-8">
          <CardContent className="p-8">
            <p className="text-lg text-gray-700 mb-6">
              At B2BNEST, operated by Edeals Master Ltd (Company No. 15242148), we are committed to protecting your privacy and ensuring the security of your personal information. 
              This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
            </p>
            <p className="text-gray-700">
              By using B2BNEST, you agree to the collection and use of information in accordance with this policy.
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
                <ul className="space-y-3">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-gray-700 flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-blue-50 shadow-lg mt-8">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-900">Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Edeals Master Ltd</strong> (Company No. 15242148) trading as B2BNEST</p>
              <p>Incorporated in England & Wales on 27 October 2023</p>
              <p>Email: privacy@b2bnest.com</p>
              <p>Registered office: 6a-6b Calvert Road, Hastings, England, TN34 3NG</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
