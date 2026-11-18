/**
 * Strong Password Generator & Validator
 */

export function generateStrongPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing chars like I, O
  const lower = 'abcdefghijkmnopqrstuvwxyz'; // Removed l
  const numbers = '23456789'; // Removed 0, 1
  const symbols = '!@#$%^&*()-_=+[]{}';

  const all = upper + lower + numbers + symbols;

  // Ensure at least one of each character class
  let password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  for (let i = password.length; i < length; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
  color: string;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Very Weak', color: 'bg-slate-300 dark:bg-slate-700' };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  switch (score) {
    case 1:
      return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    case 2:
      return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    case 3:
      return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
    case 4:
      return { score: 4, label: 'Very Strong', color: 'bg-emerald-400' };
    default:
      return { score: 0, label: 'Very Weak', color: 'bg-rose-600' };
  }
}
