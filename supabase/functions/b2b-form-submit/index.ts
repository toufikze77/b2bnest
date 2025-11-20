import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation utilities
const sanitizeString = (str: string): string => {
  return str.replace(/[<>]/g, '').trim();
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,15}$/;
  return phoneRegex.test(phone);
};

const containsSqlInjection = (str: string): boolean => {
  const sqlPatterns = /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bEXEC\b|\bEXECUTE\b|--|\/\*|\*\/|;)/i;
  return sqlPatterns.test(str);
};

const validateInput = (data: any): { valid: boolean; error?: string } => {
  // Required fields
  if (!data.company_name || data.company_name.trim().length === 0) {
    return { valid: false, error: 'Company name is required' };
  }
  if (!data.contact_name || data.contact_name.trim().length === 0) {
    return { valid: false, error: 'Contact name is required' };
  }
  if (!data.email || data.email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  if (!data.message || data.message.trim().length === 0) {
    return { valid: false, error: 'Message is required' };
  }

  // Length validation
  if (data.company_name.length > 200) {
    return { valid: false, error: 'Company name must be 200 characters or less' };
  }
  if (data.contact_name.length > 100) {
    return { valid: false, error: 'Contact name must be 100 characters or less' };
  }
  if (data.message.length > 5000) {
    return { valid: false, error: 'Message must be 5000 characters or less' };
  }

  // Email validation
  if (!validateEmail(data.email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Phone validation (if provided)
  if (data.phone && !validatePhone(data.phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  // SQL injection check
  if (containsSqlInjection(data.company_name) || 
      containsSqlInjection(data.contact_name) || 
      containsSqlInjection(data.message)) {
    return { valid: false, error: 'Invalid characters detected' };
  }

  // Optional field length validation
  if (data.industry && data.industry.length > 100) {
    return { valid: false, error: 'Industry must be 100 characters or less' };
  }
  if (data.company_size && data.company_size.length > 50) {
    return { valid: false, error: 'Company size must be 50 characters or less' };
  }

  return { valid: true };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const formData = await req.json();
    const {
      company_name,
      contact_name,
      email,
      phone,
      industry,
      company_size,
      message,
      priority = 'medium'
    } = formData;

    // Validate input
    const validation = validateInput(formData);
    if (!validation.valid) {
      console.warn(`B2B form validation failed for IP ${ip}: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhanced rate limiting: max 10 submissions per IP per day
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error: countErr } = await supabase
        .from('b2b_form_submissions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('user_id', null);

      if (!countErr && count !== null && count >= 10) {
        console.warn(`B2B form rate limit exceeded for IP ${ip}: ${count} submissions today`);
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Maximum 10 submissions per day.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      console.error('Rate limiting check failed:', e);
    }

    // Sanitize inputs
    const sanitizedData = {
      company_name: sanitizeString(company_name),
      contact_name: sanitizeString(contact_name),
      email: email.trim().toLowerCase(),
      phone: phone ? sanitizeString(phone) : null,
      industry: industry ? sanitizeString(industry) : null,
      company_size: company_size ? sanitizeString(company_size) : null,
      message: sanitizeString(message),
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium'
    };

    let aiAnalysis = null;
    let aiScore = null;

    // AI analysis if Lovable AI is available
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a B2B lead qualification assistant. Analyze the following B2B form submission and provide: 1) lead quality score (0-100), 2) key insights, 3) recommended next actions. Return JSON format with keys: score, insights (array), recommendations (array).'
              },
              {
                role: 'user',
                content: `Company: ${sanitizedData.company_name}\nContact: ${sanitizedData.contact_name}\nEmail: ${sanitizedData.email}\nPhone: ${sanitizedData.phone || 'N/A'}\nIndustry: ${sanitizedData.industry || 'N/A'}\nCompany Size: ${sanitizedData.company_size || 'N/A'}\nMessage: ${sanitizedData.message}\nPriority: ${sanitizedData.priority}`
              }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              const parsed = JSON.parse(content);
              aiScore = parsed.score || null;
              aiAnalysis = parsed;
            } catch {
              aiAnalysis = { raw_response: content };
            }
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        // Continue without AI analysis
      }
    }

    // Insert submission into database
    const { data, error } = await supabase
      .from('b2b_form_submissions')
      .insert({
        ...sanitizedData,
        ai_analysis: aiAnalysis,
        ai_score: aiScore,
      })
      .select()
      .single();

    if (error) {
      console.error('B2B form database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit form' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`B2B form submitted successfully: ID ${data.id}, Company: ${sanitizedData.company_name}, IP: ${ip}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: data.id,
        ai_score: aiScore,
        message: 'B2B form submitted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('B2B form error:', { error: error.message, ip, userAgent });
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});