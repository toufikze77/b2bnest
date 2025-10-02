import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TaskNotificationRequest {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  priority: string;
  dueDate?: string;
  assignedToId: string;
  assignedByName: string;
  projectName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      taskId, 
      taskTitle, 
      taskDescription, 
      priority, 
      dueDate, 
      assignedToId, 
      assignedByName,
      projectName 
    }: TaskNotificationRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get assignee's email
    const { data: assigneeData, error: assigneeError } = await supabase
      .from('profiles')
      .select('email, display_name, full_name')
      .eq('id', assignedToId)
      .single();

    if (assigneeError || !assigneeData?.email) {
      console.error('Error fetching assignee email:', assigneeError);
      return new Response(
        JSON.stringify({ error: 'Could not find assignee email' }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const assigneeName = assigneeData.display_name || assigneeData.full_name || 'there';
    const priorityColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444'
    };
    const priorityColor = priorityColors[priority] || priorityColors.medium;

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "B2BNest Tasks <noreply@b2bnest.online>",
      to: [assigneeData.email],
      subject: `New Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
            New Task Assignment
          </h1>
          
          <p>Hi ${assigneeName},</p>
          
          <p>${assignedByName} has assigned you a new task:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1f2937; margin-top: 0;">${taskTitle}</h2>
            
            ${taskDescription ? `
              <p style="color: #4b5563; margin: 10px 0;">
                <strong>Description:</strong><br/>
                ${taskDescription}
              </p>
            ` : ''}
            
            <div style="display: flex; gap: 20px; margin-top: 15px;">
              <div>
                <strong style="color: #6b7280;">Priority:</strong>
                <span style="
                  background-color: ${priorityColor}; 
                  color: white; 
                  padding: 4px 12px; 
                  border-radius: 12px; 
                  font-size: 12px;
                  margin-left: 8px;
                ">${priority.toUpperCase()}</span>
              </div>
              
              ${dueDate ? `
                <div>
                  <strong style="color: #6b7280;">Due Date:</strong>
                  <span style="margin-left: 8px;">${new Date(dueDate).toLocaleDateString()}</span>
                </div>
              ` : ''}
            </div>
            
            ${projectName ? `
              <div style="margin-top: 15px;">
                <strong style="color: #6b7280;">Project:</strong>
                <span style="margin-left: 8px;">${projectName}</span>
              </div>
            ` : ''}
          </div>
          
          <p>
            <a href="https://b2bnest.online/project-management" 
               style="
                 display: inline-block;
                 background-color: #2563eb;
                 color: white;
                 padding: 12px 24px;
                 text-decoration: none;
                 border-radius: 6px;
                 font-weight: bold;
               ">
              View Task
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Best regards,<br/>
            The B2BNest Team
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            This is an automated notification. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    console.log("Task notification email sent successfully:", emailResponse);

    // Create in-app notification
    await supabase.from('notifications').insert({
      user_id: assignedToId,
      title: 'New Task Assigned',
      message: `${assignedByName} assigned you: ${taskTitle}`,
      type: 'task_assigned'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id 
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-task-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
