import { confirmOne, type Confirmed } from '@/lib/confirmedWrite';

/** The slice of the Supabase client Note Pro writes use (narrow so tests can pass a fake). */
export interface NotesWrites {
  from: (table: 'notes') => {
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (cols: 'id') => Confirmed } } };
    delete: () => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { select: (cols: 'id') => Confirmed } } };
  };
}

/** Note Pro update and delete: filtered by note id and the signed-in user, and only exactly one changed row is success. */
export function notesApi(client: NotesWrites, userId: string) {
  return {
    update: (id: string, row: Record<string, unknown>) => confirmOne(() => client.from('notes').update(row).eq('id', id).eq('user_id', userId).select('id')),
    remove: (id: string) => confirmOne(() => client.from('notes').delete().eq('id', id).eq('user_id', userId).select('id')),
  };
}
