import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { escapeHtml, escapeHtmlMultiline } from "../_shared/html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type NotificationType = 
  | 'task_assigned'
  | 'task_completed'
  | 'task_status_changed'
  | 'task_due_reminder'
  | 'task_overdue'
  | 'task_comment'
  | 'project_update';

interface TaskNotificationRequest {
  notificationType: NotificationType;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  priority?: string;
  dueDate?: string;
  recipientUserId: string;
  triggeredByName: string;
  projectName?: string;
  oldStatus?: string;
  newStatus?: string;
  commentContent?: string;
  commentAuthor?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller — function is configured with verify_jwt = true,
    // but we double-check in code as defense-in-depth.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabaseUrlForAuth = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonForAuth = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrlForAuth, supabaseAnonForAuth, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const requestData: TaskNotificationRequest = await req.json();
    
    // Support legacy format (backward compatibility)
    const notificationType = requestData.notificationType || 'task_assigned';
    const recipientUserId = requestData.recipientUserId || (requestData as any).assignedToId;
    const triggeredByName = requestData.triggeredByName || (requestData as any).assignedByName;

    console.log('📧 Processing notification:', { 
      type: notificationType, 
      taskId: requestData.taskId,
      recipientUserId 
    });

    // Check Gmail credentials
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD secrets.");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check user's notification preferences
    const preferenceField = `email_${notificationType.replace(/-/g, '_')}`;
    const { data: prefData, error: prefError } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', recipientUserId)
      .maybeSingle();

    // If no preferences exist, create default ones (all enabled)
    let preferences = prefData;
    if (!preferences) {
      const { data: newPref, error: insertError } = await supabase
        .from('user_notification_preferences')
        .insert({ user_id: recipientUserId })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating notification preferences:', insertError);
      } else {
        preferences = newPref;
      }
    }

    // Check if this notification type is enabled
    const isEnabled = preferences ? preferences[preferenceField] !== false : true;
    
    if (!isEnabled) {
      console.log(`📧 Notification type ${notificationType} is disabled for user ${recipientUserId}`);
      
      // Log the skipped notification
      await supabase.from('notification_logs').insert({
        user_id: recipientUserId,
        notification_type: notificationType,
        task_id: requestData.taskId,
        email_sent: false,
        metadata: { reason: 'user_preference_disabled' }
      });

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'notification_disabled' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get recipient's email and info
    const { data: recipientData, error: recipientError } = await supabase
      .from('profiles')
      .select('email, display_name, full_name')
      .eq('id', recipientUserId)
      .maybeSingle();
    
    console.log('Fetching recipient profile for ID:', recipientUserId);

    if (recipientError) {
      console.error('Error fetching recipient profile:', recipientError);
      return new Response(
        JSON.stringify({ error: 'Database error fetching recipient', details: recipientError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    let recipientEmail = recipientData?.email;
    
    // Fallback to auth.users if no email in profiles
    if (!recipientEmail) {
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(recipientUserId);
      
      if (authError || !authData?.user?.email) {
        console.error('Could not find email:', authError);
        return new Response(
          JSON.stringify({ error: 'Could not find recipient email' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      recipientEmail = authData.user.email;
    }

    const recipientName = recipientData?.display_name || recipientData?.full_name || 'there';
    
    // Generate email content based on notification type
    const emailContent = generateEmailContent({
      notificationType,
      recipientName,
      taskTitle: requestData.taskTitle,
      taskDescription: requestData.taskDescription,
      priority: requestData.priority,
      dueDate: requestData.dueDate,
      triggeredByName,
      projectName: requestData.projectName,
      oldStatus: requestData.oldStatus,
      newStatus: requestData.newStatus,
      commentContent: requestData.commentContent,
      commentAuthor: requestData.commentAuthor
    });

    console.log("Sending task notification email via Gmail SMTP to:", recipientEmail);

    // Send email via Gmail SMTP
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    await client.close();

    console.log("Task notification email sent successfully via Gmail SMTP");

    // Log the notification
    await supabase.from('notification_logs').insert({
      user_id: recipientUserId,
      notification_type: notificationType,
      task_id: requestData.taskId,
      email_sent: true,
      metadata: { subject: emailContent.subject }
    });

    // Create in-app notification
    try {
      await supabase.from('notifications').insert({
        user_id: recipientUserId,
        title: emailContent.inAppTitle,
        message: emailContent.inAppMessage,
        type: notificationType
      });
      console.log('In-app notification created');
    } catch (notifError) {
      console.error('Failed to create in-app notification (non-critical):', notifError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }), 
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-task-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

interface EmailContentParams {
  notificationType: NotificationType;
  recipientName: string;
  taskTitle: string;
  taskDescription?: string;
  priority?: string;
  dueDate?: string;
  triggeredByName: string;
  projectName?: string;
  oldStatus?: string;
  newStatus?: string;
  commentContent?: string;
  commentAuthor?: string;
}

interface EmailContent {
  subject: string;
  html: string;
  inAppTitle: string;
  inAppMessage: string;
}

function generateEmailContent(params: EmailContentParams): EmailContent {
  const {
    notificationType,
    priority,
    dueDate,
  } = params;

  // HTML-escape every user-controlled string before it lands in the template.
  // Plain (unescaped) versions are kept ONLY for in-app/subject text fields
  // (subject + inAppMessage) which are rendered as plain text by the client.
  const recipientName = escapeHtml(params.recipientName);
  const taskTitle = escapeHtml(params.taskTitle);
  const taskDescription = params.taskDescription ? escapeHtmlMultiline(params.taskDescription) : '';
  const triggeredByName = escapeHtml(params.triggeredByName);
  const projectName = params.projectName ? escapeHtml(params.projectName) : '';
  const oldStatus = escapeHtml(params.oldStatus ?? '');
  const newStatus = escapeHtml(params.newStatus ?? '');
  const commentContent = params.commentContent ? escapeHtmlMultiline(params.commentContent) : '';
  const commentAuthor = params.commentAuthor ? escapeHtml(params.commentAuthor) : '';
  const safePriority = priority ? escapeHtml(priority.toUpperCase()) : '';

  // Plain text versions for subject lines and in-app messages
  const plainTaskTitle = String(params.taskTitle ?? '');
  const plainTriggeredByName = String(params.triggeredByName ?? '');
  const plainProjectName = String(params.projectName ?? '');
  const plainCommentAuthor = String(params.commentAuthor ?? '');

  const priorityColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    urgent: '#dc2626'
  };
  const priorityColor = priorityColors[priority?.toLowerCase() || 'medium'] || '#f59e0b';

  const formatDate = (date?: string) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const baseStyles = `
    <style>
      .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
      .header { color: #333; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
      .task-card { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .task-title { color: #1f2937; margin-top: 0; }
      .priority-badge { background-color: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; display: inline-block; }
      .status-badge { background-color: #3b82f6; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; display: inline-block; }
      .cta-button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
      .footer { color: #6b7280; font-size: 14px; margin-top: 30px; }
      .muted { color: #9ca3af; font-size: 12px; }
    </style>
  `;

  let subject = '';
  let heading = '';
  let mainContent = '';
  let inAppTitle = '';
  let inAppMessage = '';

  switch (notificationType) {
    case 'task_assigned':
      subject = `New Task Assigned: ${plainTaskTitle}`;
      heading = 'New Task Assignment';
      inAppTitle = 'New Task Assigned';
      inAppMessage = `${plainTriggeredByName} assigned you: ${plainTaskTitle}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p><strong>${triggeredByName}</strong> has assigned you a new task:</p>
        <div class="task-card">
          <h2 class="task-title">${taskTitle}</h2>
          ${taskDescription ? `<p style="color: #4b5563;">${taskDescription}</p>` : ''}
          <div style="margin-top: 15px;">
            ${safePriority ? `<span class="priority-badge">${safePriority}</span>` : ''}
            ${dueDate ? `<span style="margin-left: 15px; color: #6b7280;">Due: ${formatDate(dueDate)}</span>` : ''}
          </div>
          ${projectName ? `<p style="margin-top: 15px; color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
      `;
      break;

    case 'task_completed':
      subject = `Task Completed: ${plainTaskTitle}`;
      heading = 'Task Completed';
      inAppTitle = 'Task Completed';
      inAppMessage = `${plainTriggeredByName} completed: ${plainTaskTitle}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p><strong>${triggeredByName}</strong> has completed a task:</p>
        <div class="task-card">
          <h2 class="task-title">✅ ${taskTitle}</h2>
          <p style="color: #10b981;"><strong>Status:</strong> Completed</p>
          ${projectName ? `<p style="color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
      `;
      break;

    case 'task_status_changed':
      subject = `Task Status Updated: ${plainTaskTitle}`;
      heading = 'Task Status Changed';
      inAppTitle = 'Task Status Changed';
      inAppMessage = `${plainTriggeredByName} changed "${plainTaskTitle}" from ${params.oldStatus ?? ''} to ${params.newStatus ?? ''}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p><strong>${triggeredByName}</strong> has updated a task status:</p>
        <div class="task-card">
          <h2 class="task-title">${taskTitle}</h2>
          <p style="color: #4b5563;">
            Status changed from <span style="text-decoration: line-through;">${oldStatus}</span> 
            to <span class="status-badge">${newStatus}</span>
          </p>
          ${projectName ? `<p style="color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
      `;
      break;

    case 'task_due_reminder':
      subject = `⏰ Reminder: "${plainTaskTitle}" is due soon`;
      heading = 'Task Due Reminder';
      inAppTitle = 'Task Due Soon';
      inAppMessage = `"${plainTaskTitle}" is due on ${formatDate(dueDate)}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p>This is a friendly reminder that a task is due soon:</p>
        <div class="task-card" style="border-left: 4px solid #f59e0b;">
          <h2 class="task-title">⏰ ${taskTitle}</h2>
          <p style="color: #f59e0b; font-weight: bold;">Due: ${formatDate(dueDate)}</p>
          ${safePriority ? `<span class="priority-badge">${safePriority}</span>` : ''}
          ${projectName ? `<p style="margin-top: 15px; color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
      `;
      break;

    case 'task_overdue':
      subject = `🚨 Overdue: "${plainTaskTitle}"`;
      heading = 'Task Overdue';
      inAppTitle = 'Task Overdue';
      inAppMessage = `"${plainTaskTitle}" was due on ${formatDate(dueDate)}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p>A task assigned to you is now <strong style="color: #ef4444;">overdue</strong>:</p>
        <div class="task-card" style="border-left: 4px solid #ef4444;">
          <h2 class="task-title">🚨 ${taskTitle}</h2>
          <p style="color: #ef4444; font-weight: bold;">Was due: ${formatDate(dueDate)}</p>
          ${safePriority ? `<span class="priority-badge">${safePriority}</span>` : ''}
          ${projectName ? `<p style="margin-top: 15px; color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
        <p>Please update the task status or complete it as soon as possible.</p>
      `;
      break;

    case 'task_comment':
      subject = `New Comment on: ${plainTaskTitle}`;
      heading = 'New Comment';
      inAppTitle = 'New Comment';
      inAppMessage = `${plainCommentAuthor || plainTriggeredByName} commented on: ${plainTaskTitle}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p><strong>${commentAuthor || triggeredByName}</strong> commented on a task:</p>
        <div class="task-card">
          <h2 class="task-title">${taskTitle}</h2>
          <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 10px; border-left: 3px solid #3b82f6;">
            <p style="color: #4b5563; margin: 0;">"${commentContent}"</p>
          </div>
          ${projectName ? `<p style="margin-top: 15px; color: #6b7280;"><strong>Project:</strong> ${projectName}</p>` : ''}
        </div>
      `;
      break;

    case 'project_update':
      subject = `Project Update: ${plainProjectName || plainTaskTitle}`;
      heading = 'Project Update';
      inAppTitle = 'Project Update';
      inAppMessage = `${plainTriggeredByName} updated project: ${plainProjectName || plainTaskTitle}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p><strong>${triggeredByName}</strong> has made updates to the project:</p>
        <div class="task-card">
          <h2 class="task-title">${projectName || taskTitle}</h2>
          ${taskDescription ? `<p style="color: #4b5563;">${taskDescription}</p>` : ''}
        </div>
      `;
      break;

    default:
      subject = `Task Update: ${plainTaskTitle}`;
      heading = 'Task Update';
      inAppTitle = 'Task Update';
      inAppMessage = `Update on: ${plainTaskTitle}`;
      mainContent = `
        <p>Hi ${recipientName},</p>
        <p>There's an update on your task:</p>
        <div class="task-card">
          <h2 class="task-title">${taskTitle}</h2>
          ${taskDescription ? `<p style="color: #4b5563;">${taskDescription}</p>` : ''}
        </div>
      `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles}</head>
    <body>
      <div class="container">
        <h1 class="header">${heading}</h1>
        ${mainContent}
        <p>
          <a href="https://b2bnest.online/project-management" class="cta-button">
            View Task
          </a>
        </p>
        <p class="footer">
          Best regards,<br/>
          The B2BNest Team
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p class="muted">
          This is an automated notification. 
          <a href="https://b2bnest.online/settings" style="color: #3b82f6;">Manage your notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, html, inAppTitle, inAppMessage };
}

serve(handler);
