import React, { useState } from 'react';
import { FolderManager } from './FolderManager';
import { Plus, FileText, Download, Eye, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface LibraryItem {
  id: string;
  name: string;
  type: 'document' | 'template' | 'image' | 'other';
  folderId: string;
  size: string;
  createdAt: Date;
  tags: string[];
}

export const LibraryManager = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<LibraryItem[]>([
    {
      id: '1',
      name: 'Business Plan Template.docx',
      type: 'document',
      folderId: '2',
      size: '2.1 MB',
      createdAt: new Date(),
      tags: ['template', 'business']
    },
    {
      id: '2',
      name: 'Project Proposal.pdf',
      type: 'document',
      folderId: '1',
      size: '1.8 MB',
      createdAt: new Date(),
      tags: ['proposal', 'project']
    }
  ]);

  const filteredItems = items.filter(item => {
    const matchesFolder = !selectedFolder || item.folderId === selectedFolder;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  const getTypeIcon = (type: LibraryItem['type']) => {
    switch (type) {
      case 'document':
      case 'template':
        return <FileText className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Library</h1>
          <p className="text-muted-foreground">Organize and manage your files and documents</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Upload File
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Sidebar */}
        <div className="lg:col-span-1">
          <FolderManager
            onFolderSelect={setSelectedFolder}
            onFolderCreate={(folder) => {
              console.log('Created folder:', folder);
            }}
            onFolderDelete={(folderId) => {
              setItems(prev => prev.filter(item => item.folderId !== folderId));
            }}
            onFolderRename={(folderId, newName) => {
              console.log('Renamed folder:', folderId, newName);
            }}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files and documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedFolder ? `Folder Contents` : 'All Files'} 
                  ({filteredItems.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No files found</p>
                  <p className="text-sm">
                    {selectedFolder ? 'This folder is empty' : 'Upload your first file to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getTypeIcon(item.type)}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{item.size}</span>
                            <Separator orientation="vertical" className="h-4" />
                            <span>{item.createdAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};