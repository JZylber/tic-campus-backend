export type StudentTable = Array<{
  Id: string;
  DNI: string;
  Mail: string;
  Apellido: string;
  Nombre: string;
}>;

export type StudentCourseTable = Array<{
  Id: string;
  Apellido: string;
  Nombre: string;
  Año: string;
  Curso: string;
}>;
