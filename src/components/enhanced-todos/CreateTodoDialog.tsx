import React, { useState } from 'react';
import { Plus, Flag, Calendar, Users, Brain, X, Check } from 'lucide-react';

// Mock components since we don't have access to shadcn/ui in this environment
const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children, className }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

const DialogHeader = ({ children }) => (
  <div className="mb-6">
    {children}
  </div>
);

const DialogTitle = ({ children, className }) => (
  <h2 className={`text-xl font-semibold ${className}`}>
    {children}
  </h2>
);

const DialogTrigger = ({ children, asChild }) => children;

const Button = ({ children, onClick = (e) => {}, type = "button", variant = "default", size = "default", className = "", disabled = false }) => {
  const baseClasses = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500";
  const variantClasses = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100",
    destructive: "bg-red-600 text-white hover:bg-red-700"
  };
  const sizeClasses = {
    default: "px-4 py-2",
    sm: "px-3 py-1 text-sm",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button
      type={type as "button" | "submit" | "reset"}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const Input = ({ value, onChange, placeholder = "", type = "text", required = false, min = "", className = "", id = "", onKeyPress = (e) => {} }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={onChange}
    onKeyPress={onKeyPress}
    placeholder={placeholder}
    required={required}
    min={min}
    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  />
);

const Label = ({ htmlFor = "", children }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

const Textarea = ({ value, onChange, placeholder, rows = 3, id }) => (
  <textarea
    id={id}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
);

const Select = ({ value, onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span>{value}</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {React.Children.map(children, child =>
            React.cloneElement(child, { onSelect: (val) => { onValueChange(val); setIsOpen(false); } })
          )}
        </div>
      )}
    </div>
  );
};

const SelectItem = ({ value, onSelect = (val) => {}, children }) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
  >
    {children}
  </button>
);

// SubtaskManager Component
const SubtaskManager = ({ subtasks, onSubtasksChange }) => {
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const subtask = {
        id: Date.now().toString(),
        title: newSubtask.trim(),
        completed: false,
        estimated_hours: 1
      };
      onSubtasksChange([...subtasks, subtask]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (id) => {
    onSubtasksChange(subtasks.filter(st => st.id !== id));
  };

  const updateSubtask = (id, field, value) => {
    onSubtasksChange(subtasks.map(st =>
      st.id === id ? { ...st, [field]: value } : st
    ));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          placeholder="Add a subtask..."
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
        />
        <Button onClick={addSubtask} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
     
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded">
          <Input
            value={subtask.title}
            onChange={(e) => updateSubtask(subtask.id, 'title', e.target.value)}
            className="flex-1"
            placeholder="Subtask title"
          />
          <Input
            type="number"
            value={subtask.estimated_hours}
            onChange={(e) => updateSubtask(subtask.id, 'estimated_hours', parseInt(e.target.value) || 0)}
            className="w-20"
            min="0"
            placeholder="Hours"
          />
          <Button
            onClick={() => removeSubtask(subtask.id)}
            variant="destructive"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

// AITaskSuggestions Component
const AITaskSuggestions = ({ taskTitle, onApplySuggestion }) => {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = () => {
    setLoading(true);
    // Simulate AI suggestions based on task title
    setTimeout(() => {
      const mockSuggestions = {
        subtasks: [
          { title: `Research for: ${taskTitle}`, estimated_hours: 2 },
          { title: `Plan implementation of: ${taskTitle}`, estimated_hours: 1 },
          { title: `Execute: ${taskTitle}`, estimated_hours: 4 },
          { title: `Review and test: ${taskTitle}`, estimated_hours: 1 }
        ],
        estimated_hours: 8,
        priority: taskTitle.toLowerCase().includes('urgent') || taskTitle.toLowerCase().includes('important') ? 'high' : 'medium',
        assignee: 'john@example.com'
      };
      setSuggestions(mockSuggestions);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <Button onClick={generateSuggestions} disabled={loading || !taskTitle.trim()}>
        <Brain className="h-4 w-4 mr-2" />
        {loading ? 'Generating...' : 'Generate AI Suggestions'}
      </Button>

      {suggestions && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <h4 className="font-medium mb-3">AI Suggestions:</h4>
         
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Estimated Hours: {suggestions.estimated_hours}</p>
              <p className="text-sm font-medium">Suggested Priority: {suggestions.priority}</p>
              <p className="text-sm font-medium">Suggested Assignee: {suggestions.assignee}</p>
            </div>
           
            <div>
              <p className="text-sm font-medium mb-2">Suggested Subtasks:</p>
              <ul className="text-sm space-y-1">
                {suggestions.subtasks.map((st, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{st.title}</span>
                    <span className="text-gray-500">{st.estimated_hours}h</span>
                  </li>
                ))}
              </ul>
            </div>
           
            <Button onClick={() => onApplySuggestion(suggestions)} size="sm">
              <Check className="h-4 w-4 mr-2" />
              Apply Suggestions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
export const CreateTodoDialog = ({ onCreateTodo, isOpen, onOpenChange }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    start_date: '',
    estimated_hours: '',
    labels: '',
    assigned_to: ''
  });
 
  const [subtasks, setSubtasks] = useState([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
   
    if (!formData.title.trim()) return;

    const todoData = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      due_date: formData.due_date || undefined,
      start_date: formData.start_date || undefined,
      estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : undefined,
      labels: formData.labels.split(',').map(label => label.trim()).filter(Boolean),
      assigned_to: formData.assigned_to || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      completed: false,
      created_at: new Date().toISOString()
    };

    onCreateTodo(todoData);
   
    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      start_date: '',
      estimated_hours: '',
      labels: '',
      assigned_to: ''
    });
    setSubtasks([]);
    setShowAISuggestions(false);
   
    onOpenChange(false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAISuggestionApply = (suggestion) => {
    if (suggestion.subtasks) {
      setSubtasks(suggestion.subtasks.map((st, idx) => ({
        id: `ai-subtask-${idx}-${Date.now()}`,
        title: st.title,
        completed: false,
        estimated_hours: st.estimated_hours
      })));
    }
    if (suggestion.estimated_hours) {
      setFormData(prev => ({ ...prev, estimated_hours: suggestion.estimated_hours.toString() }));
    }
    if (suggestion.assignee) {
      setFormData(prev => ({ ...prev, assigned_to: suggestion.assignee }));
    }
    if (suggestion.priority) {
      setFormData(prev => ({ ...prev, priority: suggestion.priority }));
    }
  };

  // Mock user list for assignment
  const mockUsers = [
    { id: 'user1', name: 'John Doe', email: 'john@example.com' },
    { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user3', name: 'Mike Johnson', email: 'mike@example.com' },
    { id: 'user4', name: 'Sarah Wilson', email: 'sarah@example.com' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Create New Task
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
              >
                <Brain className="h-4 w-4 mr-2" />
                {showAISuggestions ? 'Hide' : 'Show'} AI Suggestions
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
       
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter task title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-green-600" />
                      Low
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-yellow-600" />
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-red-600" />
                      High
                    </div>
                  </SelectItem>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Estimated Hours</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={(e) => handleChange('estimated_hours', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  placeholder=""
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  placeholder=""
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleChange('assigned_to', value)}>
                <SelectItem value="">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Unassigned
                  </div>
                </SelectItem>
                {mockUsers.map((user) => (
                  <SelectItem key={user.id} value={user.email}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {user.name} ({user.email})
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labels">Labels (comma-separated)</Label>
              <Input
                id="labels"
                value={formData.labels}
                onChange={(e) => handleChange('labels', e.target.value)}
                placeholder="bug, feature, urgent..."
              />
            </div>

            <div className="space-y-2">
              <Label>Subtasks</Label>
              <SubtaskManager
                subtasks={subtasks}
                onSubtasksChange={setSubtasks}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={(e) => handleSubmit(e)} className="flex-1">
                Create Task
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </div>

          {showAISuggestions && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">AI Task Assistant</h3>
              <AITaskSuggestions
                taskTitle={formData.title}
                onApplySuggestion={handleAISuggestionApply}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};