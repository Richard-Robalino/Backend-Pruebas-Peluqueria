export function paginateQuery(query: any, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return query.skip(skip).limit(limit);
}
