import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { generateToken } from '../lib/jwt';
import { checkRateLimit } from '../lib/redis';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    const { success } = await checkRateLimit('auth', ip);

    if (!success) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (data.user) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .single();

      const token = generateToken({
        userId: data.user.id,
        email: data.user.email!,
        role: 'customer',
      });

      return res.json({
        success: true,
        user: customer,
        token,
      });
    }

    res.status(401).json({ error: 'Login failed' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    const { success } = await checkRateLimit('auth', ip);

    if (!success) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { name, email, phone, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('customers').insert({
        auth_user_id: data.user.id,
        name,
        email,
        phone,
      });

      if (profileError) {
        return res.status(400).json({ error: profileError.message });
      }

      return res.json({
        success: true,
        message: 'Account created! Please check your email to verify.',
      });
    }

    res.status(400).json({ error: 'Signup failed' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
