import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OTP_LENGTH = 8;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const generateOtp = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(OTP_LENGTH));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
};

const hashOtp = async (otp: string) => {
  const data = new TextEncoder().encode(otp);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sendEmail = async (apiKey: string, from: string, to: string, otp: string) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Your signup OTP',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Your Viralkaro signup code</h2>
          <p>Use this OTP to continue creating your account:</p>
          <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
          <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email send failed: ${errorText}`);
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const otpFromEmail = Deno.env.get('OTP_FROM_EMAIL');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Missing Supabase server configuration.' });
  }

  if (!resendApiKey || !otpFromEmail) {
    return json(500, { error: 'Missing email provider configuration.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, email, otp, password, name } = await req.json();
    const normalizedEmail = normalizeEmail(String(email || ''));

    if (!normalizedEmail) {
      return json(400, { error: 'Email is required.' });
    }

    if (action === 'send') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        return json(409, { error: 'An account with this email already exists.' });
      }

      const { data: existingOtp } = await supabase
        .from('signup_otps')
        .select('id, updated_at, expires_at')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (
        existingOtp?.updated_at &&
        Date.now() - new Date(existingOtp.updated_at).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000
      ) {
        return json(429, { error: 'Please wait before requesting another OTP.' });
      }

      const generatedOtp = generateOtp();
      const otpHash = await hashOtp(generatedOtp);
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

      const { error } = await supabase.from('signup_otps').upsert({
        email: normalizedEmail,
        otp_hash: otpHash,
        expires_at: expiresAt,
        verified_at: null,
        attempts: 0,
      }, { onConflict: 'email' });

      if (error) {
        return json(500, { error: 'Failed to save OTP.' });
      }

      try {
        await sendEmail(resendApiKey, otpFromEmail, normalizedEmail, generatedOtp);
      } catch (emailError) {
        await supabase.from('signup_otps').delete().eq('email', normalizedEmail);
        throw emailError;
      }

      return json(200, { message: 'OTP sent successfully.' });
    }

    if (action === 'verify') {
      const rawOtp = String(otp || '').trim().toUpperCase();
      if (rawOtp.length !== OTP_LENGTH) {
        return json(400, { error: 'OTP must be 8 characters.' });
      }

      const { data: record, error } = await supabase
        .from('signup_otps')
        .select('id, otp_hash, expires_at, attempts')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error || !record) {
        return json(404, { error: 'OTP not found. Request a new OTP.' });
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        return json(400, { error: 'OTP expired. Request a new OTP.' });
      }

      if ((record.attempts || 0) >= 5) {
        return json(429, { error: 'Too many invalid attempts. Request a new OTP.' });
      }

      const incomingHash = await hashOtp(rawOtp);
      if (incomingHash !== record.otp_hash) {
        await supabase.from('signup_otps')
          .update({ attempts: (record.attempts || 0) + 1 })
          .eq('id', record.id);

        return json(400, { error: 'Invalid OTP.' });
      }

      const { error: updateError } = await supabase
        .from('signup_otps')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', record.id);

      if (updateError) {
        return json(500, { error: 'Failed to verify OTP.' });
      }

      return json(200, { message: 'OTP verified successfully.' });
    }

    if (action === 'complete') {
      const trimmedName = String(name || '').trim();
      const rawPassword = String(password || '');

      if (!trimmedName) {
        return json(400, { error: 'Name is required.' });
      }

      if (rawPassword.length < 6) {
        return json(400, { error: 'Password must be at least 6 characters.' });
      }

      const { data: record, error } = await supabase
        .from('signup_otps')
        .select('id, verified_at, expires_at')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error || !record) {
        return json(404, { error: 'OTP verification record not found.' });
      }

      if (!record.verified_at) {
        return json(400, { error: 'Verify your OTP first.' });
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        return json(400, { error: 'OTP expired. Request a new OTP.' });
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        return json(409, { error: 'An account with this email already exists.' });
      }

      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          name: trimmedName,
        },
      });

      if (createUserError) {
        return json(400, { error: createUserError.message });
      }

      const userId = createdUser.user?.id;
      if (!userId) {
        return json(500, { error: 'User creation failed.' });
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: trimmedName,
          email: normalizedEmail,
          account_status: 'active',
          instagram_connection_status: 'not_connected',
        })
        .eq('user_id', userId);

      if (profileError) {
        await supabase.auth.admin.deleteUser(userId);
        return json(500, { error: 'Profile update failed.' });
      }

      await supabase.from('signup_otps').delete().eq('id', record.id);
      return json(200, { message: 'Account created successfully.' });
    }

    return json(400, { error: 'Invalid action.' });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
});
