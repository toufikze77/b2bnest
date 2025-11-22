import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Star, Archive, FileText, Search } from "lucide-react";

export default function NotePro() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tags: [],
    is_favorite: false,
    is_pinned: false,
    is_archived: false,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user?.id)
      .eq("category", "note")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load notes");
    } else {
      setNotes(data || []);
    }
  };

  const handleSaveNote = async (e) => {
    e?.preventDefault();
    
    if (!user) {
      toast.error("Please sign in to save notes");
      return;
    }

    const noteData = {
      ...formData,
      user_id: user.id,
      category: "note",
    };

    if (selectedNote) {
      const { error } = await supabase
        .from("documents")
        .update(noteData)
        .eq("id", selectedNote.id);

      if (error) {
        toast.error("Failed to update note");
      } else {
        toast.success("Note updated successfully");
        fetchNotes();
        setShowEditor(false);
      }
    } else {
      const { error } = await supabase.from("documents").insert(noteData);

      if (error) {
        toast.error("Failed to create note");
      } else {
        toast.success("Note created successfully");
        fetchNotes();
        setShowEditor(false);
      }
    }
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    setFormData({
      title: "",
      content: "",
      tags: [],
      is_favorite: false,
      is_pinned: false,
      is_archived: false,
    });
    setShowEditor(true);
  };

  const filteredNotes = notes.filter(
    (note) =>
      !note.is_archived &&
      (note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: notes.filter((n) => !n.is_archived).length,
    favorites: notes.filter((n) => n.tags?.includes("favorite")).length,
    archived: notes.filter((n) => n.is_archived).length,
    templates: notes.filter((n) => n.tags?.includes("template")).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground rounded-2xl p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">NotePro - Professional Note Taking</h1>
              <p>Organize your thoughts, ideas, and tasks in one place</p>
            </div>
            <Button onClick={handleNewNote} variant="secondary" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              New Note
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-6 border-2 border-primary/20">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-muted-foreground">Total Notes</div>
          </Card>
          <Card className="p-6 border-2 border-yellow-500/20">
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-yellow-500" />
              <div className="text-3xl font-bold text-yellow-600">{stats.favorites}</div>
            </div>
            <div className="text-muted-foreground">Favorites</div>
          </Card>
          <Card className="p-6 border-2 border-purple-500/20">
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-purple-500" />
              <div className="text-3xl font-bold text-purple-600">{stats.templates}</div>
            </div>
            <div className="text-muted-foreground">Templates</div>
          </Card>
          <Card className="p-6 border-2 border-border">
            <div className="flex items-center gap-2">
              <Archive className="w-8 h-8 text-muted-foreground" />
              <div className="text-3xl font-bold text-muted-foreground">{stats.archived}</div>
            </div>
            <div className="text-muted-foreground">Archived</div>
          </Card>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              onClick={() => {
                setSelectedNote(note);
                setFormData({
                  title: note.title,
                  content: note.description || "",
                  tags: note.tags || [],
                  is_favorite: note.tags?.includes("favorite") || false,
                  is_pinned: false,
                  is_archived: note.is_archived || false,
                });
                setShowEditor(true);
              }}
              className="p-4 hover:shadow-lg cursor-pointer transition-all hover:border-primary/50"
            >
              <h3 className="font-bold text-lg mb-2">{note.title}</h3>
              <p className="text-muted-foreground text-sm line-clamp-3">
                {note.description?.substring(0, 100)}...
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {note.tags?.slice(0, 3).map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {filteredNotes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No notes yet. Click "New Note" to get started!</p>
          </div>
        )}
      </div>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedNote ? "Edit Note" : "Create Note"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNote} className="space-y-4">
            <div>
              <label className="block font-semibold mb-2">Title *</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Tags</label>
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (tagInput.trim()) {
                      setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
                      setTagInput("");
                    }
                  }
                }}
                placeholder="Add tag and press Enter"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {formData.tags?.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm cursor-pointer"
                    onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, idx) => idx !== i) })}
                  >
                    {tag} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
                Cancel
              </Button>
              <Button type="submit">{selectedNote ? "Update" : "Create"} Note</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
