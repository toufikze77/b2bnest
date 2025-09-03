import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ProjectManagementProps {
  projects?: any[];
  teams?: any[];
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ projects = [], teams = [] }) => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.length > 0 ? (
              projects.map((project) => (
                <Card key={project.id} className="shadow-md">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{project.description || 'No description'}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-500">No projects yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.length > 0 ? (
              teams.map((team) => (
                <Card key={team.id} className="shadow-md">
                  <CardHeader>
                    <CardTitle>{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">Team ID: {team.id}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-500">No teams yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManagement;
