/* Express 5 的路由参数类型是 string | string[] | undefined（同名参数可以重复），
   业务里只关心第一个值。 */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
