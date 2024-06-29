export class PaginateResponse<T> {
  content: T[];
  meta: {
    countPerPage: number;
    currentPage: number;
    totalPages: number;
  };
}
