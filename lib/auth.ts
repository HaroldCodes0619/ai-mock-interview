import prisma from './prisma';
import bcrypt from 'bcryptjs';

const DEFAULT_EMAIL = 'salvanaj75@gmail.com';
const DEFAULT_PASSWORD = 'Salvana';

export async function verifyUser(email: string, password: string):Promise<{ success: boolean; userId?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  // Seed default admin account automatically on first login if not yet in database
  if (!user && normalizedEmail === DEFAULT_EMAIL) {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: DEFAULT_EMAIL,
        password: hashedPassword,
      }
    });
  }

  if (!user) {
    return { success: false, error: 'User not found. Register or check your credentials.' };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  return { success: true, userId: user.id };
}

export async function registerUser(email: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    return { success: false, error: 'Email already registered.' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
    }
  });

  return { success: true, userId: newUser.id };
}
