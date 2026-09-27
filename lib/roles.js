export const isStaff=user=>!!user&&['teacher','admin','superadmin'].includes(user.role);
export const isSchoolAdmin=user=>!!user&&['admin','superadmin'].includes(user.role);
export const isDirector=user=>user?.role==='superadmin';
export const canTeach=(user,student)=>isSchoolAdmin(user)||student.teacherId===user.id;
