import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Telegraf } from 'telegraf';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');

export default async function TeacherDashboard({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const resolvedParams = await searchParams;
  const teacherId = parseInt(resolvedParams.id || '0');

  async function submitGrade(formData: FormData) {
    'use server';
    
    const assignmentId = parseInt(formData.get('assignmentId') as string);
    const studentTelegramId = formData.get('studentTelegramId') as string;
    const feedback = formData.get('feedback') as string;

    if (!assignmentId || !studentTelegramId || !feedback) return;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'GRADED' }
    });

    await bot.telegram.sendMessage(
      studentTelegramId,
      `📝 GRADING FEEDBACK:\n\nYour teacher just reviewed your assignment!\n\nFeedback: "${feedback}"`
    );

    revalidatePath('/teacher');
  }

  const assignments = await prisma.assignment.findMany({
    where: { teacherId: teacherId },
    include: {
      student: true,
      teacher: true,
    },
    orderBy: {
      deadline: 'asc',
    },
  });

  const isUrl = (text: string | null) => {
    if (!text) return false;
    return text.startsWith('http://') || text.startsWith('https://');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Teacher Command Center</h1>
            <p className="text-slate-500 mt-2 text-lg">Monitor student progress and track active assignments.</p>
          </div>
          <Link href="/" className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-colors">
            Log Out
          </Link>
        </header>

        {assignments.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-700 mb-2 mt-4">No assignments yet!</h3>
            <p className="text-slate-500">Use your Telegram bot to assign work to your students.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((assignment) => (
              <div 
                key={assignment.id} 
                className={`group relative bg-white p-6 rounded-2xl border shadow-sm transition-all duration-300 flex flex-col justify-between ${
                  assignment.status === 'GRADED' ? 'border-purple-200 opacity-75' : 'border-slate-200 hover:shadow-xl hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md ${
                      assignment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                      assignment.status === 'STUCK' ? 'bg-rose-100 text-rose-700 animate-pulse' : 
                      assignment.status === 'GRADED' ? 'bg-purple-100 text-purple-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {assignment.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                      Due: {new Date(assignment.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h2 className={`text-xl font-semibold mb-3 leading-snug ${assignment.status === 'GRADED' ? 'text-slate-500' : 'text-slate-900 group-hover:text-blue-600'}`}>
                      {assignment.description}
                    </h2>
                    <div className="flex items-center gap-2 mt-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {assignment.student?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <p className="text-sm text-slate-600">
                        Assigned to <span className="font-semibold text-slate-900">{assignment.student?.name || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>

                  {((assignment.status === 'COMPLETED' || assignment.status === 'GRADED') && (assignment as any).submission) && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Submitted Work</p>
                      
                      {isUrl((assignment as any).submission) ? (
                        <a 
                          href={(assignment as any).submission} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors border border-blue-200"
                        >
                          View Attached File
                        </a>
                      ) : (
                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap italic">
                            "{(assignment as any).submission}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {assignment.status === 'COMPLETED' && (
                    <form action={submitGrade} className="mt-4 flex flex-col gap-3">
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="studentTelegramId" value={assignment.student?.telegramId} />
                      <textarea 
                        name="feedback" 
                        required
                        placeholder="Type grade and feedback (e.g., A - Great job!)"
                        className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        rows={2}
                      ></textarea>
                      <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-sm"
                      >
                        Send Grade to Student
                      </button>
                    </form>
                  )}

                </div>

                <div className="pt-4 border-t border-slate-100 mt-6 flex justify-between items-center">
                  {assignment.status === 'STUCK' ? (
                    <div className="flex items-center gap-2 text-rose-500">
                      <p className="text-xs font-bold uppercase tracking-wide">Needs your help</p>
                    </div>
                  ) : assignment.status === 'GRADED' ? (
                    <div className="flex items-center gap-2 text-purple-500">
                      <p className="text-xs font-bold uppercase tracking-wide">Successfully Graded</p>
                    </div>
                  ) : assignment.status === 'COMPLETED' ? (
                    <div className="flex items-center gap-2 text-emerald-500">
                      <p className="text-xs font-bold uppercase tracking-wide">Waiting for grade</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="block w-2 h-2 rounded-full bg-amber-300 animate-pulse"></span>
                      <p className="text-xs font-medium italic">Student is working...</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}