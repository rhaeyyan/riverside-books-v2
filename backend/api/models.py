"""Rich domain models and helper utilities for Riverside Books.

Covers:
- Normalization helpers (normalize_phone, normalize_isbn)
- Domain entities (Book, Customer, Order, OrderItem, Event, StoreInfo, Message)
- Computed properties for stock status and hold expiration
"""

import re
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, computed_field


def normalize_phone(phone: str) -> str:
    """Normalize phone number to digits only.

    Args:
        phone: Raw phone string in any common format.

    Returns:
        Digits-only string representation.
    """
    return re.sub(r"\D", "", phone)


def normalize_isbn(isbn: str) -> str:
    """Normalize ISBN by stripping spaces/hyphens and uppercasing check digit.

    Args:
        isbn: Raw ISBN string (e.g. ISBN-10 or ISBN-13).

    Returns:
        Clean alphanumeric ISBN string with uppercase check digit.
    """
    return re.sub(r"[^0-9Xx]", "", isbn).upper()


class Book(BaseModel):
    """Domain model representing a book in the catalog and inventory."""

    isbn: str
    title: str
    author: str
    format: Literal["hardcover", "paperback"]
    price_cents: int = Field(ge=0)
    stock_count: int = Field(ge=0)
    reserved_count: int = Field(ge=0, default=0)
    low_stock_threshold: int = Field(ge=0, default=2)
    genre: str
    blurb: str = ""
    cover_image_url: str = ""
    publisher: str
    published_date: str

    @computed_field
    @property
    def available_count(self) -> int:
        """Derive currently available stock count (stock_count - reserved_count)."""
        return self.stock_count - self.reserved_count

    @computed_field
    @property
    def stock_status(self) -> str:
        """Compute stock status based on available count and low-stock threshold."""
        avail = self.available_count
        if avail <= 0:
            return "out_of_stock"
        if avail <= self.low_stock_threshold:
            return "low_stock"
        return "in_stock"


EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class Customer(BaseModel):
    """Domain model representing a bookstore customer and loyalty card.

    email is the identity key (§5.3, v0.5) and is verified against
    password_hash at login. password_hash deliberately has no field here:
    the repository layer reads/writes it at the DB row level, but a Customer
    instance built for an API response can never carry it, since the field
    does not exist on this model for response_model to (mis)handle.
    """

    customer_id: str
    email: str = Field(pattern=EMAIL_PATTERN)
    name: str
    phone: str | None = Field(default=None, pattern=r"^\d{10}$")
    stamps: int = Field(ge=0, le=9, default=0)
    rewards_available: int = Field(ge=0, default=0)
    joined_date: str


class StaffMember(BaseModel):
    """Domain model representing a staff account (§5.3, v0.5).

    Provisioned by seed data only -- no self-registration. password_hash is
    handled the same way as on Customer: it exists at the DB row level, never
    on this model, so it cannot leak through an API response.
    """

    staff_id: str
    email: str = Field(pattern=EMAIL_PATTERN)
    name: str
    role: Literal["Manager", "Bookseller"]


class OrderItem(BaseModel):
    """Domain model representing a single line item in an order."""

    isbn: str
    quantity: int = Field(gt=0, default=1)


class Order(BaseModel):
    """Domain model representing a customer pre-order / hold reservation."""

    order_id: str
    customer_id: str
    items: list[OrderItem]
    status: Literal["pending", "ready_for_pickup", "completed", "cancelled", "expired"]
    created_at: str
    hold_expires_at: str
    total_cents: int = Field(ge=0)
    notes: str = ""

    def is_expired(self) -> bool:
        """Check if a pending hold has expired past hold_expires_at."""
        if self.status != "pending":
            return False
        try:
            expiry_str = self.hold_expires_at.replace("Z", "+00:00")
            expiry_dt = datetime.fromisoformat(expiry_str)
            now = datetime.now() if expiry_dt.tzinfo is None else datetime.now(UTC)
            return now > expiry_dt
        except (ValueError, TypeError):
            return False


class Event(BaseModel):
    """Domain model representing a bookstore author or community event."""

    event_id: str
    title: str
    author_name: str
    starts_at: str
    capacity: int = Field(ge=0)
    tickets_sold: int = Field(ge=0, default=0)
    description: str = ""


class OperatingHours(BaseModel):
    """Operating hours for a single day."""

    open: str
    close: str


class StoreHours(BaseModel):
    """Store operating hours across the week."""

    monday: OperatingHours | None = None
    tuesday: OperatingHours | None = None
    wednesday: OperatingHours | None = None
    thursday: OperatingHours | None = None
    friday: OperatingHours | None = None
    saturday: OperatingHours | None = None
    sunday: OperatingHours | None = None

    def __getitem__(self, item: str) -> OperatingHours | None:
        """Allow dict-style key access."""
        return getattr(self, item.lower())

    def get(self, item: str, default: Any = None) -> Any:
        """Allow dict-style get access."""
        return getattr(self, item.lower(), default)


class StorePolicies(BaseModel):
    """Store policies for customer and chatbot consumption."""

    returns: str
    holds: str
    special_orders: str
    gifts: str


class FAQItem(BaseModel):
    """Domain model representing a FAQ question and answer pair."""

    id: str
    question: str
    keywords: list[str] = Field(default_factory=list)
    answer: str


class StoreInfo(BaseModel):
    """Domain model representing bookstore metadata, hours, policies, and FAQs."""

    name: str
    address: str
    phone: str
    email: str
    hours: StoreHours
    policies: StorePolicies
    faqs: list[FAQItem] = Field(default_factory=list)


class Message(BaseModel):
    """Domain model representing a customer escalation message."""

    message_id: str
    name: str
    contact: str
    body: str
    created_at: str
    status: Literal["new", "read"] = "new"
