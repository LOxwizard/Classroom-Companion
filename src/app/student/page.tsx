import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function StudentDashboard() {
  const assignments = await prisma.assignment.findMany({
    include: {
      teacher: true,
      student: true,
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
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Student Workspace</h1>
            <p className="text-slate-500 mt-2 text-lg">Manage your tasks, update your status, and crush your goals.</p>
          </div>
        </header>

        {assignments.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-700 mb-2 mt-4">You're all caught up!</h3>
            <p className="text-slate-500">No active assignments right now. Enjoy your free time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((assignment) => (
              <div 
                key={assignment.id} 
                className="group relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 ease-out flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Badge & Date */}
                  <div className="flex justify-between items-start mb-5">
                    <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md ${
                      assignment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                      assignment.status === 'STUCK' ? 'bg-rose-100 text-rose-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {assignment.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                      Due: {new Date(assignment.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-900 mb-3 leading-snug group-hover:text-indigo-600 transition-colors duration-200">
                      {assignment.description}
                    </h2>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <span>Assigned by <span className="font-semibold text-slate-700">{assignment.teacher.name}</span></span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-auto">
                  {assignment.feedback ? (
                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                      <p className="text-xs font-bold text-indigo-600 mb-1 uppercase tracking-wider">Teacher Feedback</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{assignment.feedback}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 p-2">
                      <span className="block w-2 h-2 rounded-full bg-slate-300 animate-pulse"></span>
                      <p className="text-xs font-medium italic">Awaiting feedback...</p>
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