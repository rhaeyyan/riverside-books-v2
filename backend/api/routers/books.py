from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.api.core.repositories import BookRepository
from backend.api.deps import get_book_repo, release_expired_holds
from backend.api.models import Book

router = APIRouter(dependencies=[Depends(release_expired_holds)])


class StockUpdate(BaseModel):
    stock_count: int


@router.get("", response_model=list[Book])
def get_books(
    q: str | None = None,
    in_stock_only: bool = False,
    limit: int | None = Query(None, gt=0),
    offset: int = Query(0, ge=0),
    repo: BookRepository = Depends(get_book_repo),
):
    books = repo.get_all(
        query=q, in_stock_only=in_stock_only, limit=limit, offset=offset
    )
    return books


@router.get("/{isbn}", response_model=Book)
def get_book(isbn: str, repo: BookRepository = Depends(get_book_repo)):
    book = repo.get_by_isbn(isbn)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.patch("/{isbn}/stock", response_model=Book)
def update_stock(
    isbn: str, payload: StockUpdate, repo: BookRepository = Depends(get_book_repo)
):
    book = repo.get_by_isbn(isbn)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if payload.stock_count < book.reserved_count:
        raise HTTPException(
            status_code=400, detail="stock_count cannot be set below reserved_count"
        )

    updated_book = repo.update_stock(isbn, payload.stock_count)
    return updated_book
