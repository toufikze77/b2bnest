import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, User, AlertCircle, CheckCircle2, Circle, Trash2, Edit3, Filter, Search, BarChart3, Users, Target, Lightbulb } from 'lucide-react';

// UI Components
const Button = ({ children, onClick, variant = "default", size = "default", className = "", disabled = false, asChild = false, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline"
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  };
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`,
      onClick,
      disabled,
      ...props
    });
  }
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

const Dialog = ({ children, open, onOpenChange }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 rounded-lg">
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children, className = "" }) => (
  <div className={`grid gap-4 ${className}`}>
    {children}
  </div>
);

const DialogHeader = ({ children }) => (
  <div className="flex flex-col space-y-1.5 text-center sm:text-left">
    {children}
  </div>
);

const DialogTitle = ({ children }) => (
  <h2 className="text-lg font-semibold leading-none tracking-tight">
    {children}
  </h2>
);

const DialogFooter = ({ children }) => (
  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
    {children}
  </div>
);

const Input = ({ className = "", ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea 
    className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

const Select = ({ children, value, onValueChange }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen(!open)}
      >
        <span>{value || "Select option..."}</span>
        <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 w-full z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {React.Children.map(children, child => 
            React.cloneElement(child, { 
              onSelect: (val) => {
                onValueChange(val);
                setOpen(false);
              }
            })
          )}
        </div>
      )}
    </div>
  );
};

const SelectItem = ({ children, value, onSelect }) => (
  <div 
    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
    onClick={() => onSelect(value)}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "text-foreground border border-input"
  };
  
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

const Popover = ({ children }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (child.type === PopoverTrigger) {
          return React.cloneElement(child, { onClick: () => setOpen(!open) });
        }
        if (child.type === PopoverContent && open) {
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              {React.cloneElement(child, { onClose: () => setOpen(false) })}
            </>
          );
        }
        return null;
      })}
    </div>
  );
};

const PopoverTrigger = ({ children, asChild, onClick }) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick });
  }
  return <div onClick={onClick}>{children}</div>;
};

const PopoverContent = ({ children, className = "", align = "center", onClose }) => (
  <div className={`absolute top-full mt-1 z-50 rounded-md border bg-popover p-0 text-popover-foreground shadow-md ${align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2'} ${className}`}>
    {children}
  </div>
);

const CalendarComponent = ({ mode, selected, onSelect, initialFocus, className = "" }) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const days = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="p-2"></div>);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const isSelected = selected && formatDate(date, 'yyyy-MM-dd') === formatDate(selected, 'yyyy-MM-dd');
    const isToday = formatDate(date, 'yyyy-MM-dd') === formatDate(today, 'yyyy-MM-dd');
    
    days.push(
      <button
        key={day}
        className={`p-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground ${
          isSelected ? 'bg-primary text-primary-foreground' : ''
        } ${isToday ? 'bg-accent' : ''}`}
        onClick={() => onSelect(date)}
      >
        {day}
      </button>
    );
  }
  
  return (
    <div className={`p-3 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">
          {formatMonthYear(new Date(currentYear, currentMonth))}
        </h3>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="p-2 text-xs font-medium text-center text-muted-foreground">
            {day}
          </div>
        ))}
        {days}
      </div>
    </div>
  );
};

// Date formatting utility functions
const formatDate = (date, formatType = 'short') => {
  if (!date) return '';
  const d = new Date(date);
  
  if (formatType === 'PPP') {
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  if (formatType === 'yyyy-MM-dd') {
    return d.toISOString().split('T')[0];
  }
  
  return d.toLocaleDateString();
};

const formatMonthYear = (date) => {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
};

// Fixed DatePicker Component
const DatePicker = ({ value, onChange, placeholder }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value ? formatDate(value, 'PPP') : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background border shadow-md z-[100]" align="start">
        <CalendarComponent
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => onChange(date ? formatDate(date, 'yyyy-MM-dd') : '')}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};

// Fixed SubtaskManager Component
const SubtaskManager = ({ subtasks, onSubtasksChange }) => {
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const subtask = {
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: newSubtask.trim(),
        completed: false,
        estimated_hours: 1
      };
      onSubtasksChange([...subtasks, subtask]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (id) => {
    onSubtasksChange(subtasks.filter(subtask => subtask.id !== id));
  };

  const toggleSubtask = (id) => {
    onSubtasksChange(subtasks.map(subtask => 
      subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask
    ));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Add a subtask..."
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
          className="flex-1"
        />
        <Button onClick={addSubtask} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {subtasks.length > 0 && (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded">
              <button
                onClick={() => toggleSubtask(subtask.id)}
                className="flex-shrink-0"
              >
                {subtask.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-500' : ''}`}>
                {subtask.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSubtask(subtask.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Fixed AI Suggestions Component
const AISuggestions = ({ taskTitle, onApplySuggestion }) => {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = async () => {
    if (!taskTitle.trim()) {
      alert('Please enter a task title first');
      return;
    }
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockSuggestions = {
        subtasks: [
          { title: `Research requirements for: ${taskTitle}`, estimated_hours: 2 },
          { title: `Plan implementation of: ${taskTitle}`, estimated_hours: 1 },
          { title: `Execute main work: ${taskTitle}`, estimated_hours: 4 },
          { title: `Review and test: ${taskTitle}`, estimated_hours: 1 },
          { title: `Document and finalize: ${taskTitle}`, estimated_hours: 1 }
        ],
        estimated_hours: 9,
        priority: taskTitle.toLowerCase().includes('urgent') || taskTitle.toLowerCase().includes('important') ? 'high' : 
                 taskTitle.toLowerCase().includes('low') || taskTitle.toLowerCase().includes('minor') ? 'low' : 'medium',
        assignee: 'john@example.com',
        tags: taskTitle.toLowerCase().includes('bug') ? ['bug', 'urgent'] : 
              taskTitle.toLowerCase().includes('feature') ? ['feature', 'enhancement'] : 
              ['task', 'general']
      };
      
      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      alert('Failed to generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (type, value) => {
    onApplySuggestion(type, value);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          AI Suggestions
        </h3>
        <Button 
          onClick={generateSuggestions} 
          disabled={loading || !taskTitle.trim()}
          size="sm"
        >
          {loading ? 'Generating...' : 'Get Suggestions'}
        </Button>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Analyzing task and generating suggestions...</p>
        </div>
      )}

      {suggestions && !loading && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-2">Suggested Subtasks:</h4>
            <div className="space-y-1">
              {suggestions.subtasks.map((subtask, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded border">
                  <span>{subtask.title} ({subtask.estimated_hours}h)</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => applySuggestion('subtask', subtask)}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Estimated Hours:</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">{suggestions.estimated_hours} hours</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => applySuggestion('hours', suggestions.estimated_hours)}
                >
                  Apply
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-1">Priority:</h4>
              <div className="flex items-center justify-between">
                <Badge variant={suggestions.priority === 'high' ? 'destructive' : suggestions.priority === 'medium' ? 'default' : 'secondary'}>
                  {suggestions.priority}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => applySuggestion('priority', suggestions.priority)}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-1">Suggested Tags:</h4>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {suggestions.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">{tag}</Badge>
                ))}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => applySuggestion('tags', suggestions.tags)}
              >
                Apply All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Task Dialog Component
const CreateTodoDialog = ({ open, onOpenChange, onCreateTodo }) => {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assignee: '',
    estimated_hours: 1,
    tags: [],
    subtasks: []
  });

  const resetForm = () => {
    setTaskData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      assignee: '',
      estimated_hours: 1,
      tags: [],
      subtasks: []
    });
  };

  const handleSubmit = () => {
    if (!taskData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    const newTask = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'todo',
      created_at: new Date().toISOString(),
      progress: 0
    };

    onCreateTodo(newTask);
    resetForm();
    onOpenChange(false);
  };

  const handleAISuggestion = (type, value) => {
    switch (type) {
      case 'subtask':
        setTaskData(prev => ({
          ...prev,
          subtasks: [...prev.subtasks, value]
        }));
        break;
      case 'hours':
        setTaskData(prev => ({
          ...prev,
          estimated_hours: value
        }));
        break;
      case 'priority':
        setTaskData(prev => ({
          ...prev,
          priority: value
        }));
        break;
      case 'tags':
        setTaskData(prev => ({
          ...prev,
          tags: [...prev.tags, ...value.filter(tag => !prev.tags.includes(tag))]
        }));
        break;
      default:
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Task Title *</label>
            <Input
              placeholder="Enter task title..."
              value={taskData.title}
              onChange={(e) => setTaskData({...taskData, title: e.target.value})}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Enter task description..."
              value={taskData.description}
              onChange={(e) => setTaskData({...taskData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select 
                value={taskData.priority} 
                onValueChange={(value) => setTaskData({...taskData, priority: value})}
              >
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Estimated Hours</label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={taskData.estimated_hours}
                onChange={(e) => setTaskData({...taskData, estimated_hours: parseFloat(e.target.value) || 1})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <DatePicker
                value={taskData.due_date}
                onChange={(date) => setTaskData({...taskData, due_date: date})}
                placeholder="Select due date"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Assignee</label>
              <Select 
                value={taskData.assignee} 
                onValueChange={(value) => setTaskData({...taskData, assignee: value})}
              >
                <SelectItem value="john@example.com">John Doe</SelectItem>
                <SelectItem value="jane@example.com">Jane Smith</SelectItem>
                <SelectItem value="mike@example.com">Mike Johnson</SelectItem>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Subtasks</label>
            <SubtaskManager
              subtasks={taskData.subtasks}
              onSubtasksChange={(subtasks) => setTaskData({...taskData, subtasks})}
            />
          </div>

          <AISuggestions
            taskTitle={taskData.title}
            onApplySuggestion={handleAISuggestion}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTodoDialog;