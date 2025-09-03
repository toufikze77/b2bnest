import React, { useState } from 'react';
import { Plus, Folder, FolderOpen, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: Date;
  itemCount: number;
}

interface FolderManagerProps {
  title?: string;
  onFolderSelect?: (folderId: string) => void;
  onFolderCreate?: (folder: Omit<Folder, 'id' | 'createdAt' | 'itemCount'>) => void;
  onFolderDelete?: (folderId: string) => void;
  onFolderRename?: (folderId: string, newName: string) => void;
}

export const FolderManager = ({ 
  title = "Folders", 
  onFolderSelect,
  onFolderCreate,
  onFolderDelete,
  onFolderRename
}: FolderManagerProps) => {
  const [folders, setFolders] = useState<Folder[]>([
    { id: '1', name: 'Documents', createdAt: new Date(), itemCount: 5 },
    { id: '2', name: 'Templates', createdAt: new Date(), itemCount: 12 },
    { id: '3', name: 'Projects', createdAt: new Date(), itemCount: 8 }
  ]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    const newFolder: Folder = {
      id: Date.now().toString(),
      name: newFolderName.trim(),
      createdAt: new Date(),
      itemCount: 0
    };

    setFolders(prev => [...prev, newFolder]);
    onFolderCreate?.(newFolder);
    setNewFolderName('');
    setShowCreateDialog(false);
    toast.success(`Folder "${newFolder.name}" created successfully`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    setFolders(prev => prev.filter(f => f.id !== folderId));
    onFolderDelete?.(folderId);
    toast.success(`Folder "${folder.name}" deleted successfully`);
  };

  const handleRenameFolder = (folderId: string) => {
    if (!editName.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    setFolders(prev => 
      prev.map(folder => 
        folder.id === folderId 
          ? { ...folder, name: editName.trim() }
          : folder
      )
    );
    onFolderRename?.(folderId, editName.trim());
    setEditingFolder(null);
    setEditName('');
    toast.success('Folder renamed successfully');
  };

  const startRename = (folder: Folder) => {
    setEditingFolder(folder.id);
    setEditName(folder.name);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="folder-name">Folder Name</Label>
                  <Input
                    id="folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFolder}>
                    Create Folder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No folders yet</p>
              <p className="text-sm">Click "New Folder" to create your first folder</p>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`group flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-accent/50 cursor-pointer ${
                  selectedFolder === folder.id ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => {
                  setSelectedFolder(folder.id);
                  onFolderSelect?.(folder.id);
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Folder className="w-5 h-5 text-primary" />
                  {editingFolder === folder.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') {
                          setEditingFolder(null);
                          setEditName('');
                        }
                      }}
                      onBlur={() => handleRenameFolder(folder.id)}
                      className="h-8"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1">
                      <p className="font-medium">{folder.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {folder.itemCount} item{folder.itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(folder);
                        }}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};