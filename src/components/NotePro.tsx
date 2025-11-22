import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/note-pro/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Plus,
  Star,
  Archive,
  FileText,
  Search,
  Grid3x3,
  List,
  Pin,
  Copy,
  Trash2,
  FolderPlus,
  Tag,
  Bell,
  CheckSquare,
  Palette,
  FileCode,
  Home,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Note {
  id: string;
  title: string;
  content: string;
  format: "richtext" | "markdown" | "plaintext";
  category_id?: string;
  tags: string[];
  color: string;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_template: boolean;
  template_name?: string;
  checklist: Array<{ id: string; text: string; completed: boolean }>;
  reminder_date?: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  order: number;
}

export default function NotePro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Omit<Note, "id" | "created_at" | "updated_at">>({
    title: "",
    content: "",
    format: "richtext",
    tags: [],
    color: "default",
    is_favorite: false,
    is_pinned: false,
    is_archived: false,
    is_template: false,
    checklist: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "blue",
    order: 0,
  });

  const colors = [
    { name: "default", value: "bg-background", label: "Default" },
    { name: "red", value: "bg-red-100", label: "Red" },
    { name: "orange", value: "bg-orange-100", label: "Orange" },
    { name: "yellow", value: "bg-yellow-100", label: "Yellow" },
    { name: "green", value: "bg-green-100", label: "Green" },
    { name: "blue", value: "bg-blue-100", label: "Blue" },
    { name: "purple", value: "bg-purple-100", label: "Purple" },
    { name: "pink", value: "bg-pink-100", label: "Pink" },
  ];

  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchCategories();
    }
  }, [user]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user?.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load notes");
    } else {
      setNotes((data as unknown as Note[]) || []);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("note_categories")
      .select("*")
      .eq("user_id", user?.id)
      .order("order", { ascending: true });

    if (error) {
      toast.error("Failed to load categories");
    } else {
      setCategories((data as unknown as Category[]) || []);
    }
  };

  const handleSaveNote = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!user) {
      toast.error("Please sign in to save notes");
      return;
    }

    const noteData = {
      ...formData,
      user_id: user.id,
    };

    if (selectedNote) {
      const { error } = await supabase
        .from("notes")
        .update(noteData)
        .eq("id", selectedNote.id);

      if (error) {
        toast.error("Failed to update note");
      } else {
        toast.success("Note updated successfully");
        fetchNotes();
        setShowEditor(false);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("notes").insert(noteData);

      if (error) {
        toast.error("Failed to create note");
      } else {
        toast.success("Note created successfully");
        fetchNotes();
        setShowEditor(false);
        resetForm();
      }
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    const { error } = await supabase.from("notes").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete note");
    } else {
      toast.success("Note deleted successfully");
      fetchNotes();
      if (selectedNote?.id === id) {
        setShowEditor(false);
        resetForm();
      }
    }
  };

  const handleDuplicateNote = async (note: Note) => {
    const { error } = await supabase.from("notes").insert({
      ...note,
      id: undefined,
      title: note.title + " (Copy)",
      user_id: user?.id,
    });

    if (error) {
      toast.error("Failed to duplicate note");
    } else {
      toast.success("Note duplicated successfully");
      fetchNotes();
    }
  };

  const handleToggleFavorite = async (note: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ is_favorite: !note.is_favorite })
      .eq("id", note.id);

    if (!error) {
      fetchNotes();
    }
  };

  const handleTogglePinned = async (note: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id);

    if (!error) {
      fetchNotes();
    }
  };

  const handleArchiveNote = async (note: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ is_archived: !note.is_archived })
      .eq("id", note.id);

    if (!error) {
      fetchNotes();
      toast.success(note.is_archived ? "Note unarchived" : "Note archived");
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    const { error } = await supabase.from("note_categories").insert({
      ...categoryForm,
      user_id: user.id,
    });

    if (error) {
      toast.error("Failed to create category");
    } else {
      toast.success("Category created successfully");
      fetchCategories();
      setShowCategoryDialog(false);
      setCategoryForm({ name: "", description: "", color: "blue", order: 0 });
    }
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    resetForm();
    setShowEditor(true);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      format: note.format,
      category_id: note.category_id,
      tags: note.tags || [],
      color: note.color,
      is_favorite: note.is_favorite,
      is_pinned: note.is_pinned,
      is_archived: note.is_archived,
      is_template: note.is_template,
      template_name: note.template_name,
      checklist: note.checklist || [],
      reminder_date: note.reminder_date,
    });
    setShowEditor(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      format: "richtext",
      tags: [],
      color: "default",
      is_favorite: false,
      is_pinned: false,
      is_archived: false,
      is_template: false,
      checklist: [],
    });
    setTagInput("");
    setChecklistInput("");
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const addChecklistItem = () => {
    if (checklistInput.trim()) {
      setFormData({
        ...formData,
        checklist: [
          ...formData.checklist,
          { id: Date.now().toString(), text: checklistInput.trim(), completed: false },
        ],
      });
      setChecklistInput("");
    }
  };

  const toggleChecklistItem = (id: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    });
  };

  const removeChecklistItem = (id: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter((item) => item.id !== id),
    });
  };

  const filteredNotes = notes.filter((note) => {
    if (activeTab === "favorites" && !note.is_favorite) return false;
    if (activeTab === "archived" && !note.is_archived) return false;
    if (activeTab === "templates" && !note.is_template) return false;
    if (activeTab === "all" && note.is_archived) return false;
    if (selectedCategory && note.category_id !== selectedCategory) return false;
    if (
      searchQuery &&
      !note.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !note.content?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const stats = {
    total: notes.filter((n) => !n.is_archived).length,
    favorites: notes.filter((n) => n.is_favorite).length,
    archived: notes.filter((n) => n.is_archived).length,
    templates: notes.filter((n) => n.is_template).length,
  };

  const checklistProgress = (checklist: typeof formData.checklist) => {
    if (!checklist.length) return 0;
    const completed = checklist.filter((item) => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground rounded-2xl p-8 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold mb-2">NotePro - Professional Note Taking</h1>
                <p className="opacity-90">Organize your thoughts, ideas, and tasks in one place</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCategoryDialog(true)} variant="secondary" size="lg">
                <FolderPlus className="w-5 h-5 mr-2" />
                Category
              </Button>
              <Button onClick={handleNewNote} variant="secondary" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                New Note
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-6 border-2 border-primary/20 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <div className="text-3xl font-bold text-primary">{stats.total}</div>
                <div className="text-muted-foreground">Total Notes</div>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-2 border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-500" fill="currentColor" />
              <div>
                <div className="text-3xl font-bold text-yellow-600">{stats.favorites}</div>
                <div className="text-muted-foreground">Favorites</div>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-2 border-purple-500/20 hover:border-purple-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <FileCode className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-3xl font-bold text-purple-600">{stats.templates}</div>
                <div className="text-muted-foreground">Templates</div>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-2 border-border hover:border-muted-foreground transition-colors">
            <div className="flex items-center gap-3">
              <Archive className="w-8 h-8 text-muted-foreground" />
              <div>
                <div className="text-3xl font-bold text-muted-foreground">{stats.archived}</div>
                <div className="text-muted-foreground">Archived</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs & Search */}
        <div className="mb-6 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Notes</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? null : val)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 border rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Notes Grid/List */}
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-3 gap-4"
              : "space-y-4"
          }
        >
          {filteredNotes.map((note) => {
            const colorClass = colors.find((c) => c.name === note.color)?.value || "bg-background";
            return (
              <Card
                key={note.id}
                className={`${colorClass} hover:shadow-lg cursor-pointer transition-all hover:border-primary/50 relative group`}
                onClick={() => handleEditNote(note)}
              >
                {note.is_pinned && (
                  <Pin className="absolute top-2 right-2 w-4 h-4 text-primary" fill="currentColor" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg flex-1">{note.title}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(note);
                        }}
                      >
                        <Star
                          className={`w-4 h-4 ${note.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateNote(note);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
                    {note.content?.substring(0, 150)}...
                  </p>

                  {note.checklist && note.checklist.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-sm">
                      <CheckSquare className="w-4 h-4" />
                      <span>{checklistProgress(note.checklist)}% Complete</span>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {note.tags?.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {note.is_template && (
                      <Badge variant="default" className="text-xs">Template</Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredNotes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No notes yet. Click "New Note" to get started!</p>
          </div>
        )}
      </div>

      {/* Note Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedNote ? "Edit Note" : "Create Note"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNote} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                <label className="block font-semibold mb-2">Format</label>
                <Select
                  value={formData.format}
                  onValueChange={(val: any) => setFormData({ ...formData, format: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="richtext">Rich Text</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="plaintext">Plain Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Content</label>
              {formData.format === "richtext" ? (
                <RichTextEditor
                  value={formData.content}
                  onChange={(value) => setFormData({ ...formData, content: value })}
                  placeholder="Write your note content..."
                />
              ) : (
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  placeholder={
                    formData.format === "markdown"
                      ? "# Use Markdown syntax here"
                      : "Write your note content..."
                  }
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Category</label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(val) =>
                    setFormData({ ...formData, category_id: val === "none" ? undefined : val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block font-semibold mb-2">Color</label>
                <Select
                  value={formData.color}
                  onValueChange={(val) => setFormData({ ...formData, color: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => (
                      <SelectItem key={color.name} value={color.name}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.value} border`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Tags</label>
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                />
                <Button type="button" onClick={addTag}>
                  Add
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {formData.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Checklist</label>
              <div className="flex gap-2 mb-2">
                <Input
                  type="text"
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  placeholder="Add checklist item"
                />
                <Button type="button" onClick={addChecklistItem}>
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {formData.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleChecklistItem(item.id)}
                    />
                    <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                      {item.text}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChecklistItem(item.id)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-2">Reminder</label>
              <Input
                type="datetime-local"
                value={formData.reminder_date || ""}
                onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.is_favorite}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_favorite: !!checked })
                  }
                />
                <Star className="w-4 h-4" />
                Favorite
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.is_pinned}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_pinned: !!checked })
                  }
                />
                <Pin className="w-4 h-4" />
                Pin
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.is_template}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_template: !!checked })
                  }
                />
                <FileCode className="w-4 h-4" />
                Save as Template
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
                Cancel
              </Button>
              <Button type="submit">{selectedNote ? "Update" : "Create"} Note</Button>
              {selectedNote && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleArchiveNote(selectedNote)}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {selectedNote.is_archived ? "Unarchive" : "Archive"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div>
              <label className="block font-semibold mb-2">Name *</label>
              <Input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Description</label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Color</label>
              <Select
                value={categoryForm.color}
                onValueChange={(val) => setCategoryForm({ ...categoryForm, color: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.name} value={color.name}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Category</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
