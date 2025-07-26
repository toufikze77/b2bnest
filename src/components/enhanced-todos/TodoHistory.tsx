import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, User } from 'lucide-react';

interface HistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_id: string;
}

interface TodoHistoryProps {
  todoId: string;
}

export const TodoHistory: React.FC<TodoHistoryProps> = ({ todoId }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [todoId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_history')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const getUserDisplayName = (entry: HistoryEntry) => {
    return 'System';
  };

  const formatFieldName = (fieldName: string) => {
    return fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value: string | null) => {
    if (value === null) return 'None';
    return value;
  };

  return (
    <div className="space-y-3">
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No history available.</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="flex gap-3 p-3 border-l-2 border-blue-200 bg-blue-50/50 rounded-r-lg">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {getUserDisplayName(entry)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  Changed <span className="font-medium">{formatFieldName(entry.field_name)}</span>
                  {entry.old_value && (
                    <span>
                      {' '}from <span className="bg-red-100 px-1 rounded text-red-700">{formatValue(entry.old_value)}</span>
                    </span>
                  )}
                  {' '}to <span className="bg-green-100 px-1 rounded text-green-700">{formatValue(entry.new_value)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};