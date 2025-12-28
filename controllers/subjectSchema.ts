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

export type ActivitiesTable = Array<{
  Id: string;
  "Id Estudiante": string;
  "Id Actividad": string;
  Nombre: string;
  Apellido: string;
  Curso: string;
  "Nombre Actividad": string;
  Realizada: string;
  Aclaración: string;
  Visible: string;
}>;

export type MarksTable = Array<{
  Id: string;
  "Id Estudiante": string;
  "Id Actividad": string;
  Nombre: string;
  Apellido: string;
  Curso: string;
  "Nombre Actividad": string;
  Nota: string;
  Aclaración: string;
  Visible: string;
}>;

export type RedosTable = Array<{}>;

export type RedoRequestsTable = Array<{}>;

export type ContentsPerCourseTable = Array<{
  Id: string;
  "Id Contenido": string;
  Nombre: string;
  Contenido: string;
  CursoXMateria: string;
  Curso: string;
  Materia: string;
  Visible: string;
  "En Curso": string;
  Opcional: string;
  Entrega: string;
  Repositorio: string;
  Tutor: string;
}>;

export type ContentsTable = Array<{
  Id: string;
  Tipo: string;
  Nombre: string;
  Tema: string;
  Unidad: string;
  Materia: string;
  Texto: string;
  Imagen: string;
}>;

export type UnitsTable = Array<{
  Id: string;
  "Id Materia": string;
  Nombre: string;
  Orden: string;
}>;

export type CourseTable = Array<{
  Id: string;
  Nombre: string;
  "Link Grupo"?: string;
  Materia: string;
}>;

export type SubjectTable = Array<{
  Id: string;
  Materia: string;
  Presentación: string;
  "Reentrega Actividades": string;
  "Reentrega TPs": string;
  "Proporción TPS/Nota": string;
  "Actividades Especiales": string;
}>;

export type SubjectXCourseTable = Array<{
  Id: string;
  Curso: string;
  "Link Grupo": string;
  Materia: string;
}>;

export type MaterialTable = Array<{
  Id: string;
  Materia: string;
  Nombre: string;
  Imagen: string;
  Descripción: string;
  Link: string;
  Tipo: string;
  Visible: string;
}>;
