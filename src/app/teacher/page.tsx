import { PrismaClient } from '@prisma/client';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function TeacherDashboard({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const resolvedParams = await searchParams;
  const teacherId = parseInt(resolvedParams.id || '0');

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
                className="group relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 ease-out flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md ${
                      assignment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                      assignment.status === 'STUCK' ? 'bg-rose-100 text-rose-700 animate-pulse' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {assignment.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                      Due: {new Date(assignment.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-900 mb-3 leading-snug group-hover:text-blue-600 transition-colors duration-200">
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
                </div>

                <div className="pt-4 border-t border-slate-100 mt-auto flex justify-between items-center">
                  {assignment.status === 'STUCK' ? (
                    <div className="flex items-center gap-2 text-rose-500">
                      <p className="text-xs font-bold uppercase tracking-wide">Needs your help</p>
                    </div>
                  ) : assignment.status === 'COMPLETED' ? (
                    <div className="flex items-center gap-2 text-emerald-500">
                      <p className="text-xs font-bold uppercase tracking-wide">Ready for review</p>
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