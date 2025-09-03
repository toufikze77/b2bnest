import { 
  fetchUserTeams, 
  fetchUserProjects
} from '@/lib/teamProjectHelpers';
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ProjectManagement from '@/components/ProjectManagement';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

const ProjectManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const [userProjects, userTeams] = await Promise.all([
          fetchUserProjects(user.id),
          fetchUserTeams(user.id)
        ]);
        
        setProjects(userProjects);
        setTeams(userTeams);
      } catch (error) {
        console.error('Error loading projects and teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600">Organize tasks, track progress, and collaborate with your team</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading projects and teams...</div>
          </div>
        ) : (
          <ProjectManagement projects={projects} teams={teams} />
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProjectManagementPage;
