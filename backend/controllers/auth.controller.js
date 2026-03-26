const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../services/email.service');

const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email format' });

  try {
    const [count] = await db.query('SELECT COUNT(*) as cnt FROM admins');
    if (count[0].cnt > 0) {
      return res.status(403).json({
        error: 'Registration is closed. Use an invitation link.'
      });
    }
    const [existing] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, 'main_admin']
    );
    res.status(201).json({ message: 'Admin registered', adminId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'No Email Exists' });
    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid Password' });
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, created_at: admin.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, created_at FROM admins WHERE id = ?', [req.admin.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json({ admin: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const [rows] = await db.query('SELECT id, name, email FROM admins WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(404).json({ error: 'No account found with this email' });

    const admin = rows[0];
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Clean up expired OTPs
    await db.query('DELETE FROM otp_store WHERE expires_at < NOW()');

    // Save OTP to DB
    await db.query(
      'REPLACE INTO otp_store (email, otp, expires_at, admin_id) VALUES (?, ?, ?, ?)',
      [email, otp, expiresAt, admin.id]
    );

    await sendOTPEmail(email, otp, admin.name);
    res.json({ message: 'OTP sent to your email!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email. Please check your email address.' });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  try {
    const [rows] = await db.query(
      'SELECT * FROM otp_store WHERE email = ? AND expires_at > NOW()',
      [email]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
    if (rows[0].otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please try again.' });

    // Delete OTP after use
    await db.query('DELETE FROM otp_store WHERE email = ?', [email]);

    const resetToken = jwt.sign(
      { adminId: rows[0].admin_id, email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    res.json({ message: 'OTP verified!', resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, decoded.adminId]);
    res.json({ message: 'Password reset successfully!' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
  }
};

module.exports = { register, login, getMe, forgotPassword, verifyOTP, resetPassword };