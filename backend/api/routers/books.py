import httpx
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




class BookCreate(BaseModel):
    isbn: str
    title: str
    author: str
    genre: str
    format: str
    price_cents: int
    stock_count: int
    cover_image_url: str | None = None
    blurb: str | None = ""


@router.get("/external/{isbn}")
async def lookup_external(isbn: str):
    """Fetch book metadata from OpenLibrary API."""
    # We use the OpenLibrary Search API or Books API
    url = (
        f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    )
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to reach OpenLibrary")

        data = response.json()
        key = f"ISBN:{isbn}"
        if key not in data:
            raise HTTPException(status_code=404, detail="Book not found on OpenLibrary")

        book_data = data[key]

        authors = ", ".join([a["name"] for a in book_data.get("authors", [])])

        cover = ""
        if "cover" in book_data and "large" in book_data["cover"]:
            cover = book_data["cover"]["large"]

        return {
            "isbn": isbn,
            "title": book_data.get("title", ""),
            "author": authors,
            "cover_image_url": cover,
        }


@router.post("", response_model=Book)
def create_book(payload: BookCreate, repo: BookRepository = Depends(get_book_repo)):
    try:
        new_book = Book(
            isbn=payload.isbn,
            title=payload.title,
            author=payload.author,
            genre=payload.genre,
            format=payload.format,
            price_cents=payload.price_cents,
            stock_count=payload.stock_count,
            reserved_count=0,
            cover_image_url=payload.cover_image_url,
            blurb=payload.blurb or "",
        )
        return repo.create(new_book)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
