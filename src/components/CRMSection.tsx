
import { Users, Calendar, BarChart3, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CRMSection = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Customer Relationship Management</h2>
          <p className="text-xl text-gray-600 mb-6">Streamline your customer interactions and grow your business</p>
          <div className="inline-flex items-center px-6 py-3 bg-blue-100 text-blue-800 rounded-full font-semibold">
            🚀 Coming Soon
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center">
            <CardHeader>
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Contact Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Organize and manage all your customer contacts in one place</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Activity Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Track meetings, calls, and follow-ups with customers</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Sales Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Get insights into your sales performance and trends</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Communication</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Integrated email and messaging tools</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default CRMSection;
