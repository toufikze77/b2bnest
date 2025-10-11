import { TodoComments } from './enhanced-todos/TodoComments';
import JiraTaskView from './JiraTaskView';
import { CommentButton } from './CommentButton';
import { CheckSquare, Users, Clock, Folder } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
const ProjectManagementSection = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Project Management</h2>
          <p className="text-xl text-gray-600 mb-6">Manage your projects from start to finish with powerful tools</p>
          <div className="inline-flex items-center px-6 py-3 bg-green-100 text-green-800 rounded-full font-semibold">
            🚀 Coming Soon
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center">
            <CardHeader>
              <CheckSquare className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Task Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Create, assign, and track tasks across your team</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Work together seamlessly with your team members</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Track time spent on projects and tasks</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Folder className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Project Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Organize projects with folders and custom workflows</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ProjectManagementSection;
