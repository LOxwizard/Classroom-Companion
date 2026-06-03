import { PrismaClient } from '@prisma/client';
import { redirect } from 'next/navigation';

const prisma = new PrismaClient();

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const resolvedParams = await searchParams;

  async function handleLogin(formData: FormData) {
    'use server';
    
    const uid = formData.get('uid') as string;
    if (!uid) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: uid },
    });

    if (user?.role === 'TEACHER') {
      redirect(`/teacher?id=${user.id}`);
    } else if (user?.role === 'STUDENT') {
      redirect(`/student?id=${user.id}`);
    } else {
      redirect('/?error=1');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-sm">
            <span className="text-2xl font-bold tracking-wider">CC</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Companion Portal</h1>
          <p className="text-slate-500 mt-2">Enter your Telegram ID to access your workspace.</p>
        </div>

        <form action={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="uid" className="block text-sm font-semibold text-slate-700 mb-2">
              Telegram ID
            </label>
            <input
              type="text"
              id="uid"
              name="uid"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
              placeholder="e.g., 123456789"
            />
          </div>

          {resolvedParams?.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-600 text-center font-medium">
                Account not found. Please message the Telegram bot to register.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-colors duration-200 shadow-md"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}