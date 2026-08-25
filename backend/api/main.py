from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routers import (
    books,
    chat,
    customers,
    events,
    marketing,
    messages,
    orders,
    store,
)
from backend.config import settings

app = FastAPI(title="Riverside Books API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(store.router, prefix="/api/store", tags=["store"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(marketing.router, prefix="/api/marketing", tags=["marketing"])
