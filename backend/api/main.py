from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Scope

from backend.api.routers import (
    books,
    chat,
    customers,
    events,
    marketing,
    messages,
    orders,
    staff,
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
app.include_router(staff.router, prefix="/api/staff", tags=["staff"])


class SPAStaticFiles(StaticFiles):
    """Serves a built single-page app, falling back to index.html for client routes.

    A request for a client-side route (e.g. /shop/book/9780...) doesn't
    correspond to a real file, so the default StaticFiles 404s on it.
    Falling back to index.html hands the request to the app's own router.
    """

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


_REPO_ROOT = Path(__file__).resolve().parents[2]


def _mount_dir(path: str, dist_dir: Path, name: str, *, spa_fallback: bool) -> None:
    """Mount a directory if present; a no-op otherwise (e.g. under pytest).

    spa_fallback=True falls back to index.html for unmatched sub-paths, for
    a client-side router (React Router). The landing page has no router of
    its own, so it mounts as plain StaticFiles and 404s normally.
    """
    if not dist_dir.is_dir():
        return
    static_cls = SPAStaticFiles if spa_fallback else StaticFiles
    app.mount(path, static_cls(directory=dist_dir, html=True), name=name)


# Gateway: unify both frontends and the landing page behind this one process.
# Requires `npm run build` in each app first - absent in tests, which never
# build the frontends, so these mounts are silently skipped.
_mount_dir(
    "/shop", _REPO_ROOT / "apps" / "customer-app" / "dist", "shop", spa_fallback=True
)
_mount_dir(
    "/staff",
    _REPO_ROOT / "apps" / "staff-dashboard" / "dist",
    "staff",
    spa_fallback=True,
)
_mount_dir("/", _REPO_ROOT / "web", "landing", spa_fallback=False)
