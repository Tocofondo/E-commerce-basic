"""Agrega los routers de cada módulo bajo /api/v1.

Cuando se agregue un módulo nuevo con su propio `router.py`, se importa e
incluye acá.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.orders.router import router as orders_router
from app.modules.products.router import router as products_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
