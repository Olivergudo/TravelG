export const formatLongDate = (value: string) =>
  new Date(value).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
