// src/app/api/invite/route.ts – NUCLEAR VERSION (No workspaces)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, inviterName, inviterTell } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    // Verify the caller is authenticated
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get inviter's Tell number if not provided
    let inviterTellNumber = inviterTell
    if (!inviterTellNumber) {
      const { data: tellUser } = await createClient(supabaseUrl, serviceRoleKey)
        .from('tell_users')
        .select('tell_number')
        .eq('id', user.id)
        .single()
      inviterTellNumber = tellUser?.tell_number || 'unknown'
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if user already exists in tell_users
    const { data: existingUser } = await supabaseAdmin
      .from('tell_users')
      .select('email, tell_number')
      .eq('email', email)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const signupLink = `${appUrl}/auth?signup=true&email=${encodeURIComponent(email)}`

    if (existingUser) {
      // User exists – send login reminder
      const html = `
        <div style="font-family: 'Oswald', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: linear-gradient(145deg, #0a0a0a, #121212); border-radius: 24px; border: 1px solid #FF6A00;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 48px; font-weight: bold; color: #FF6A00;">TELL</div>
            <div style="height: 4px; background: #FF6A00; width: 100px; margin: 20px auto;"></div>
          </div>
          <h2 style="color: #FFFFFF;">You're already on Tell</h2>
          <p style="color: #B8E4A0;">${inviterName || 'Someone'} (Tell‑number: ${inviterTellNumber}) wants to connect with you.</p>
          <p style="color: #B8E4A0;">Your Tell‑number: <strong style="color: #FF6A00;">${existingUser.tell_number}</strong></p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}/dashboard" style="background: #FF6A00; color: #000; padding: 12px 32px; border-radius: 24px; text-decoration: none; font-weight: bold;">Go to Tell</a>
          </div>
        </div>
      `
      
      // Send via Supabase Auth (invite email)
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${appUrl}/auth` },
      })
      
      return NextResponse.json({ success: true, alreadyExists: true, tellNumber: existingUser.tell_number })
    }

    // New user – send invitation
    const html = `
      <div style="font-family: 'Oswald', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: linear-gradient(145deg, #0a0a0a, #121212); border-radius: 24px; border: 1px solid #FF6A00;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 48px; font-weight: bold; color: #FF6A00; text-shadow: 0 0 10px #FF6A00;">TELL</div>
          <div style="height: 4px; background: linear-gradient(90deg, #FF6A00, #B00020); width: 100px; margin: 20px auto;"></div>
        </div>
        <h2 style="color: #FFFFFF;">You've been invited to <span style="color: #FF6A00;">Tell</span></h2>
        <p style="color: #B8E4A0; line-height: 1.6;">${inviterName || 'Someone'} (Tell‑number: ${inviterTellNumber}) has invited you to join the most sovereign privacy network.</p>
        <div style="background: #0a0a0a; border-radius: 18px; padding: 20px; margin: 30px 0; text-align: center;">
          <p style="color: #B8E4A0;">Click below to claim your sovereign identity:</p>
          <a href="${signupLink}" style="display: inline-block; background: #FF6A00; color: #000000; padding: 12px 32px; border-radius: 24px; text-decoration: none; font-weight: bold;">Join Tell Now</a>
        </div>
        <p style="color: #FF6A00; text-align: center; font-size: 14px;">🔒 End‑to‑end encrypted • Peer‑to‑peer • No third parties</p>
      </div>
    `

    // Send invite via Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: signupLink,
      data: {
        inviter_name: inviterName,
        inviter_tell: inviterTellNumber,
      },
    })

    if (error) {
      console.error('Invite error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, invited: true })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send invite' },
      { status: 500 }
    )
  }
}